import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, Film, Lightbulb, PenLine, Play, RotateCcw, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { buildMadlibItem, buildMadlibItems, streamVideoCards, type FlashCard, type MadlibItem, type TrackedVideo } from '../services/madlibs';
import { relativeDay } from '../utils/flashcardStorage';
import { saveMadlibProgress, clearMadlibProgress, getMostRecentMadlibProgress, type MadlibProgress } from '../utils/madlibsStorage';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { ExpandableSearch } from '../components/ExpandableSearch';
import { Skeleton } from '../components/Skeleton';
import { NavigationIconButton } from '../components/NavigationIconButton';
import { queryClient } from '../lib/queryClient';
import { type CachedMadlibDeck, historyQueryOptions, queryKeys, videoVocabularyQueryOptions } from '../lib/queries';
import { mapWithConcurrency } from '../lib/network';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';

type Page = 'video' | 'practice' | 'flashcards' | 'analytics' | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';
interface MadlibsPageProps { onNavigate: (page: Page) => void; }
type Phase = 'deck' | 'loading' | 'playing' | 'done';
type SortKey = 'words' | 'recent';

interface AnswerRecord {
  item: MadlibItem;
  chosen: string;
  correct: boolean;
}

const PAGE_SIZE = 6;
const MAX_MADLIB_ITEMS = 12;
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'words', label: 'Most words' },
  { value: 'recent', label: 'Recently watched' },
];

function isNetflix(videoId: string): boolean {
  return videoId.startsWith('netflix_');
}

function cardKey(card: FlashCard): string {
  return `${card.dictionary_form || card.target_word}\u0000${card.sentence || ''}`;
}

function VideoThumb({ video, dimmed }: { video: TrackedVideo; dimmed?: boolean }) {
  if (isNetflix(video.video_id)) {
    return (
      <span className={`flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-[#B20710]/10 ${dimmed ? 'opacity-40' : ''}`}>
        <Film className="h-5 w-5 text-[#B20710]" />
      </span>
    );
  }
  return (
    <img
      src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
      alt=""
      className={`h-14 w-24 shrink-0 rounded-lg object-cover ${dimmed ? 'opacity-40' : ''}`}
      onError={(event) => { event.currentTarget.style.display = 'none'; }}
    />
  );
}

export function MadlibsPage({ onNavigate }: MadlibsPageProps) {
  const { language } = useLanguage();
  const { token, user } = useAuth();
  const [phase, setPhase] = useState<Phase>('deck');
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('words');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);
  const [items, setItems] = useState<MadlibItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [resumable, setResumable] = useState<MadlibProgress | null>(null);
  const [isStreamingCards, setIsStreamingCards] = useState(false);
  const rawCardsRef = useRef<FlashCard[]>([]);
  const rawCardKeysRef = useRef(new Set<string>());
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamRunRef = useRef(0);

  useEffect(() => {
    if (phase !== 'deck' || !user) {
      setResumable(null);
      return;
    }
    setResumable(getMostRecentMadlibProgress(user.id, language));
  }, [phase, language, user]);

  useEffect(() => {
    if (phase !== 'playing' || !user || !deck || items.length === 0 || answers.length === 0) return;
    saveMadlibProgress({
      userId: user.id,
      videoId: deck.id,
      title: deck.title,
      language,
      items,
      answers: answers.map((a) => ({ chosen: a.chosen, correct: a.correct })),
      updatedAt: Date.now(),
    });
  }, [phase, user, deck, items, answers, language]);

  useEffect(() => {
    if (!user || !token) {
      setVideos([]);
      return;
    }
    let alive = true;
    const historyKey = queryKeys.history(user.id, language);
    const cached = queryClient.getQueryData<TrackedVideo[]>(historyKey);
    setVideos(cached ?? null);
    void queryClient.ensureQueryData(historyQueryOptions(user.id, token, language))
      .then((nextVideos) => {
        if (!alive) return;
        setVideos(nextVideos);
        setResumable((current) => {
          if (!current || nextVideos.some((video) => video.video_id === current.videoId)) return current;
          clearMadlibProgress(user.id, language, current.videoId);
          return null;
        });
      })
      .catch(() => { if (alive && !cached) setVideos([]); });
    return () => { alive = false; };
  }, [language, token, user]);

  useEffect(() => {
    if (!videos?.length || !user || !token) return;
    let alive = true;
    const cachedCounts = Object.fromEntries(
      videos.flatMap((video) => {
        const cached = queryClient.getQueryData<{ totalWords: number }>(
          queryKeys.videoVocabulary(user.id, language, video.video_id),
        );
        return cached ? [[video.video_id, cached.totalWords] as const] : [];
      }),
    );
    setWordCounts(cachedCounts);

    const missing = videos.filter((video) => cachedCounts[video.video_id] === undefined);
    void mapWithConcurrency(missing, 2, async (video) => {
      try {
        const vocabulary = await queryClient.fetchQuery(
          videoVocabularyQueryOptions(user.id, token, language, video.video_id),
        );
        if (alive) setWordCounts((current) => ({ ...current, [video.video_id]: vocabulary.totalWords }));
      } catch {
        if (alive) setWordCounts((current) => ({ ...current, [video.video_id]: 0 }));
      }
    });
    return () => { alive = false; };
  }, [videos, language, token, user]);

  useEffect(() => () => streamAbortRef.current?.abort(), []);

  useEffect(() => {
    if (phase === 'loading' && items.length > 0) setPhase('playing');
  }, [items.length, phase]);

  const resetRound = () => { setIndex(0); setSelected(null); setRevealed(false); setShowHint(false); setAnswers([]); };

  const stopDeckStream = useCallback(() => {
    streamRunRef.current += 1;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setIsStreamingCards(false);
  }, []);

  const startDeck = useCallback((video: TrackedVideo) => {
    stopDeckStream();
    setDeck({ id: video.video_id, title: video.title });
    resetRound();
    setPhase('loading');
    const cacheKey = queryKeys.madlibDeck(user?.id ?? 0, language, video.video_id);
    const cached = queryClient.getQueryData<CachedMadlibDeck<FlashCard>>(cacheKey);
    rawCardsRef.current = cached?.cards ?? [];
    rawCardKeysRef.current = new Set(rawCardsRef.current.map(cardKey));
    const cachedItems = buildMadlibItems(rawCardsRef.current, MAX_MADLIB_ITEMS);
    setItems(cachedItems);
    if (cachedItems.length > 0 || cached?.isComplete) setPhase('playing');
    if (cached?.isComplete) return;

    const run = ++streamRunRef.current;
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setIsStreamingCards(true);

    const appendNewItems = () => {
      setItems((current) => {
        if (current.length >= MAX_MADLIB_ITEMS) return current;
        const present = new Set(current.map((item) => item.id));
        const additions = rawCardsRef.current.flatMap((card, position) => {
          const item = buildMadlibItem(card, rawCardsRef.current, `${card.dictionary_form || card.target_word}-${position}`);
          return item && !present.has(item.id) ? [item] : [];
        }).slice(0, MAX_MADLIB_ITEMS - current.length);
        if (!additions.length) return current;
        return [...current, ...additions];
      });
    };

    void streamVideoCards(video.video_id, language, {
      token,
      signal: controller.signal,
      onCard: (card) => {
        if (streamRunRef.current !== run) return;
        const key = cardKey(card);
        if (rawCardKeysRef.current.has(key)) return;
        rawCardKeysRef.current.add(key);
        rawCardsRef.current = [...rawCardsRef.current, card];
        queryClient.setQueryData<CachedMadlibDeck<FlashCard>>(cacheKey, (current) => ({
          cards: [...(current?.cards ?? []), card],
          isComplete: false,
        }));
        appendNewItems();
      },
    }).then(() => {
      if (streamRunRef.current !== run) return;
      queryClient.setQueryData<CachedMadlibDeck<FlashCard>>(cacheKey, {
        cards: rawCardsRef.current,
        isComplete: true,
      });
      streamAbortRef.current = null;
      setIsStreamingCards(false);
      setPhase((current) => current === 'loading' ? 'playing' : current);
    }).catch((error: unknown) => {
      if (streamRunRef.current !== run || controller.signal.aborted) return;
      console.error('Unable to stream Mad Libs cards', error);
      streamAbortRef.current = null;
      setIsStreamingCards(false);
      setPhase((current) => current === 'loading' ? 'playing' : current);
    });
  }, [language, stopDeckStream, token, user?.id]);

  const replay = useCallback(() => {
    if (!deck) return;
    startDeck({ video_id: deck.id, title: deck.title, tracked_at: Date.now() });
  }, [deck, startDeck]);

  const resumeDeck = useCallback((progress: MadlibProgress) => {
    setDeck({ id: progress.videoId, title: progress.title });
    setItems(progress.items);
    setAnswers(progress.answers.map((a, i) => ({ item: progress.items[i], chosen: a.chosen, correct: a.correct })));
    setIndex(progress.answers.length);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setResumable(null);
    setPhase('playing');
  }, []);

  const restartResumable = useCallback((progress: MadlibProgress) => {
    if (!user) return;
    clearMadlibProgress(user.id, language, progress.videoId);
    setResumable(null);
    void startDeck({ video_id: progress.videoId, title: progress.title, tracked_at: Date.now() });
  }, [language, startDeck, user]);

  const choose = useCallback((option: string) => {
    const item = items[index];
    if (revealed || !item) return;
    setSelected(option);
    setRevealed(true);
    setAnswers((prev) => [...prev, { item, chosen: option, correct: option === item.answer }]);
  }, [items, index, revealed]);

  const next = useCallback(() => {
    if (index + 1 >= items.length) {
      if (isStreamingCards) {
        setIndex((value) => value + 1);
        setSelected(null);
        setRevealed(false);
        setShowHint(false);
        return;
      }
      if (deck && user) clearMadlibProgress(user.id, language, deck.id);
      setPhase('done');
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
  }, [index, items.length, deck, isStreamingCards, language, user]);

  useEffect(() => {
    if (phase !== 'playing' || isStreamingCards || items.length === 0 || index < items.length) return;
    if (deck && user) clearMadlibProgress(user.id, language, deck.id);
    setPhase('done');
  }, [deck, index, isStreamingCards, items.length, language, phase, user]);

  // 1–4 pick an option before reveal, Enter advances once it's revealed.
  useEffect(() => {
    if (phase !== 'playing' || !items.length) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter' && revealed) { event.preventDefault(); next(); return; }
      const digit = Number(event.key);
      const item = items[index];
      if (!revealed && item && !Number.isNaN(digit) && digit >= 1 && digit <= item.options.length) {
        choose(item.options[digit - 1]);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, items, index, revealed, choose, next]);

  const back = (target: 'practice' | 'deck') => (
    <NavigationIconButton
      direction="back"
      label={target === 'practice' ? 'Back to Practice' : 'Back to videos'}
      onClick={() => {
        stopDeckStream();
        target === 'practice' ? onNavigate('practice') : setPhase('deck');
      }}
    />
  );

  if (phase === 'deck') {
    const practiceVideos = (videos ?? []).filter((video) => (wordCounts[video.video_id] ?? 0) > 0);
    const isCountingWords = (videos ?? []).some((video) => wordCounts[video.video_id] === undefined);
    const filtered = practiceVideos.filter((v) => v.title.toLowerCase().includes(query.trim().toLowerCase()));
    const sorted = [...filtered].sort((a, b) =>
      sort === 'words' ? (wordCounts[b.video_id] ?? 0) - (wordCounts[a.video_id] ?? 0) : b.tracked_at - a.tracked_at,
    );
    const shown = sorted.slice(0, visible);
    const currentSort = SORTS.find((s) => s.value === sort) ?? SORTS[0];

    return (
      <motion.main
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8"
      >
        <div className="-ml-2 flex items-center gap-2">
          {back('practice')}
          <h1 className="font-heading text-section font-medium text-primary">Mad libs</h1>
        </div>

        {resumable && videos?.some((video) => video.video_id === resumable.videoId) && (
          <section className="mt-8" aria-labelledby="continue-practicing-heading">
            <h2 id="continue-practicing-heading" className="font-sans text-[0.9375rem] font-semibold uppercase tracking-[0.08em] text-secondary">Continue practicing</h2>
            <div className="mt-2 flex min-h-24 flex-wrap items-center gap-6 rounded-2xl bg-dusk-soft px-7 py-5 sm:flex-nowrap">
              <VideoThumb video={{ video_id: resumable.videoId, title: resumable.title, tracked_at: 0 }} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading text-body font-semibold text-dusk-deep">{resumable.title}</h3>
                <p className="mt-1 text-body-sm text-dusk-ink">{resumable.answers.length} of {resumable.items.length} blanks filled</p>
                <div className="mt-2 flex gap-1">
                  {resumable.items.map((resumeItem, i) => (
                    <span key={resumeItem.id} className={`h-1.5 flex-1 rounded-full ${i < resumable.answers.length ? 'bg-accent' : 'bg-dusk-mid/40'}`} />
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-5">
                <Button
                  type="button"
                  onClick={() => resumeDeck(resumable)}
                >
                  <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                  Resume
                </Button>
                <Button
                  type="button"
                  onClick={() => restartResumable(resumable)}
                  variant="ghost"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Restart
                </Button>
              </div>
            </div>
          </section>
        )}

        <section className="mt-14" aria-labelledby="madlibs-library">
          {practiceVideos.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-subtle pb-4">
              <h2 id="madlibs-library" className="font-heading text-card-title font-medium text-primary">Your videos</h2>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                <ExpandableSearch
                  value={query}
                  onChange={(value) => { setQuery(value); setVisible(PAGE_SIZE); }}
                  label="Search videos"
                  placeholder="Search a video"
                />
                <DropdownMenu open={isSortOpen} onOpenChange={setIsSortOpen} className="shrink-0">
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="sm" className="h-10 rounded-xl bg-app px-4 text-body-sm font-semibold text-primary hover:bg-surface-hover">
                      {currentSort.label}
                      <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isSortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      <span className="sr-only">Sort videos</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent aria-label="Sort videos" className="w-48">
                    {SORTS.map((option) => {
                      const isSelected = option.value === sort;
                      return <DropdownMenuItem key={option.value} onSelect={() => { setSort(option.value); setVisible(PAGE_SIZE); }} className={isSelected ? 'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent' : ''}>
                        <span className="flex-1 text-left">{option.label}</span>
                        {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                      </DropdownMenuItem>;
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}

          {videos === null ? (
            <div className="pt-6" role="status" aria-live="polite" aria-label="Loading your videos">
              <Skeleton className="h-80 w-full rounded-2xl" />
            </div>
          ) : isCountingWords ? (
            <div className="pt-6" role="status" aria-live="polite" aria-label="Finding words in your videos">
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : practiceVideos.length === 0 ? (
            <PracticeEmptyState mode="Mad Libs" />
          ) : shown.length === 0 ? (
            <p className="py-16 text-center text-body text-muted">No videos match &quot;{query}&quot;.</p>
          ) : (
            <>
              <ul>
                {shown.map((video, position) => {
                  const count = wordCounts[video.video_id];
                  const ready = (count ?? 0) > 0;
                  return (
                    <motion.li
                      key={video.video_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(position * 0.03, 0.2) }}
                      className="flex items-center gap-5 border-b border-subtle py-4"
                    >
                      <VideoThumb video={video} dimmed={!ready} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-body font-semibold ${ready ? 'text-primary' : 'text-muted'}`}>{video.title}</p>
                        <p className="mt-0.5 truncate text-body-sm text-muted">
                          {isNetflix(video.video_id) ? 'Netflix' : 'YouTube'} · {relativeDay(video.tracked_at)}
                        </p>
                      </div>
                      {count !== undefined && (
                        <p className={`hidden w-24 shrink-0 text-right text-body-sm font-semibold sm:block ${ready ? 'text-accent' : 'text-muted'}`}>
                          {ready ? `${count} ready` : 'No words yet'}
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={() => ready && void startDeck(video)}
                        disabled={!ready}
                        variant="secondary"
                        className="shrink-0 bg-surface-hover enabled:hover:bg-accent-soft"
                      >
                        Practice
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </motion.li>
                  );
                })}
              </ul>
              {visible < sorted.length && (
                <Button
                  type="button"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                  variant="ghost"
                  className="mt-6 w-full"
                >
                  Show {Math.min(PAGE_SIZE, sorted.length - visible)} more of {sorted.length}
                </Button>
              )}
            </>
          )}
        </section>
      </motion.main>
    );
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
        <div className="mx-auto w-full max-w-2xl" role="status" aria-live="polite" aria-label="Preparing your practice">
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  if (phase === 'playing' && items.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
        <div className="-ml-2 flex items-center gap-2">
          {back('deck')}
          <h1 className="font-heading text-section font-medium text-primary">Mad libs</h1>
        </div>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover text-primary">
            <PenLine className="h-6 w-6" />
          </span>
          <h2 className="font-heading text-card-title text-primary">Not enough words here yet</h2>
          <p className="max-w-sm text-body-sm text-secondary">
            This video doesn&apos;t have enough example sentences to build Mad Libs. Try another video.
          </p>
          <Button
            type="button"
            onClick={() => setPhase('deck')}
            className="mt-1"
          >
            Pick another video
          </Button>
        </div>
      </main>
    );
  }

  if (phase === 'done') {
    const correct = answers.filter((a) => a.correct).length;
    const missed = answers.filter((a) => !a.correct);
    const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0;
    const stats: { label: string; value: string }[] = [
      { label: 'Correct', value: String(correct) },
      { label: 'Missed', value: String(missed.length) },
      { label: 'Accuracy', value: `${accuracy}%` },
    ];
    const reviewList = missed.length > 0 ? missed : answers;

    return (
      <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
        <div className="-ml-2 flex items-center gap-2">
          {back('deck')}
          <h1 className="font-heading text-section font-medium text-primary">Mad libs</h1>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="mt-6">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <p className="font-heading text-[3rem] leading-none text-primary">{correct}</p>
            <p className="mt-3 text-body text-secondary">
              of {answers.length} {answers.length === 1 ? 'blank' : 'blanks'} filled correctly
            </p>
            {deck && <p className="mt-1 max-w-sm truncate text-body-sm text-muted">{deck.title}</p>}

            <div className="mt-10 grid w-full grid-cols-3 gap-2 border-t border-subtle pt-8">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-lead font-semibold text-primary">{stat.value}</p>
                  <p className="mt-1 text-meta uppercase tracking-[0.08em] text-muted">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => void replay()}
                size="lg"
              >
                Play again
              </Button>
              <Button
                type="button"
                onClick={() => setPhase('deck')}
                variant="secondary"
                size="lg"
              >
                Pick another video
              </Button>
            </div>
          </div>

          {answers.length > 0 && (
            <section className="mx-auto mt-16 max-w-2xl" aria-labelledby="madlibs-review">
              <div className="border-b border-subtle pb-4">
                <h2 id="madlibs-review" className="font-heading text-card-title text-primary">
                  {missed.length > 0 ? 'Worth another look' : 'Everything you filled'}
                </h2>
              </div>
              <ul>
                {reviewList.map((answer, i) => (
                  <li key={`${answer.item.id}-${i}`} className="flex items-start gap-4 border-b border-subtle py-4">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${answer.correct ? 'bg-sage-ink/15 text-sage-ink' : 'bg-accent/15 text-accent'}`}>
                      {answer.correct ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body text-primary">
                        {answer.item.before}
                        <strong className="font-semibold text-accent">{answer.item.answer}</strong>
                        {answer.item.after}
                      </p>
                      <p className="mt-0.5 text-body-sm text-muted">
                        {answer.item.answer} — {answer.item.gloss}
                        {!answer.correct && ` · you chose "${answer.chosen}"`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </motion.div>
      </main>
    );
  }

  const item = items[index];
  const progress = items.length
    ? (Math.min(index + (revealed ? 1 : 0), items.length) / items.length) * 100
    : 0;

  if (!item) {
    return (
      <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-4 sm:px-8">
        <header className="mx-auto flex h-9 w-full max-w-2xl items-center justify-between gap-4">
          <div className="-ml-2 flex items-center">{back('deck')}</div>
          <span className="shrink-0 text-body-sm tabular-nums text-muted">{index + 1} / …</span>
        </header>
        <div className="mx-auto mt-8 w-full max-w-2xl" role="status" aria-live="polite" aria-label="Preparing your next blank">
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-4 sm:px-8">
      <header className="mx-auto flex h-9 w-full max-w-2xl shrink-0 items-center justify-between">
        <div className="-ml-2 flex items-center">{back('deck')}</div>
        <div className="flex items-center gap-3">
          <div
            className="h-2 w-32 overflow-hidden rounded-full bg-surface-hover sm:w-48"
            role="progressbar"
            aria-valuenow={index + (revealed ? 1 : 0)}
            aria-valuemin={0}
            aria-valuemax={items.length}
            aria-label="Mad libs progress"
          >
            <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <span className="shrink-0 text-right text-body-sm tabular-nums text-muted">{index + 1} / {items.length}</span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22 }}
          className="mx-auto mt-8 w-full max-w-2xl"
        >
          <article className="rounded-2xl border border-subtle bg-surface p-7 sm:p-9">
            <p className="text-meta font-semibold uppercase tracking-wider text-muted">Fill the blank</p>
            <p className="mt-5 font-heading text-2xl leading-snug text-primary sm:text-3xl">
              {item.before}
              <BlankSlot revealed={revealed} answer={item.answer} correct={selected === item.answer} />
              {item.after}
            </p>
            <div className="mt-6 min-h-6">
              {!revealed && (
                showHint ? (
                  <p className="text-body-sm text-secondary">
                    Hint — the word means <strong className="text-primary">&quot;{item.gloss}&quot;</strong>
                  </p>
                ) : item.gloss ? (
                  <Button type="button" onClick={() => setShowHint(true)} variant="ghost" size="sm" className="gap-1.5 px-0">
                    <Lightbulb className="h-4 w-4" />
                    Show hint
                  </Button>
                ) : null
              )}
              {revealed && item.translation && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-body-sm italic text-secondary">
                  {item.translation}
                </motion.p>
              )}
            </div>
          </article>

          <p className="mb-3 mt-6 text-meta font-semibold uppercase tracking-wider text-muted">Choose your word</p>
          <div className="grid grid-cols-2 gap-3">
            {item.options.map((option, position) => {
              const answer = option === item.answer;
              const chosen = option === selected;
              const state = revealed
                ? answer
                  ? 'bg-sage-ink text-on-accent'
                  : chosen
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-muted opacity-60'
                : 'bg-surface text-primary hover:bg-surface-hover';
              return (
                <motion.button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  disabled={revealed}
                  whileTap={revealed ? undefined : { scale: 0.98 }}
                  animate={revealed && chosen && !answer ? { x: [0, -5, 5, 0] } : {}}
                  className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 py-4 text-lead font-semibold ${state}`}
                >
                  {revealed && answer && <Check className="h-4 w-4" strokeWidth={3} />}
                  {revealed && chosen && !answer && <X className="h-4 w-4" strokeWidth={3} />}
                  {option}
                  {!revealed && <span className="ml-1 text-meta font-medium text-muted">{position + 1}</span>}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {revealed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center justify-between gap-4">
                <span className={`text-body-sm font-semibold ${selected === item.answer ? 'text-sage-ink' : 'text-accent'}`}>
                  {selected === item.answer ? 'Correct!' : `Answer: ${item.answer}`}
                </span>
                <Button type="button" onClick={next}>
                  {isStreamingCards || index + 1 < items.length ? 'Next' : 'Finish'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function BlankSlot({ revealed, answer, correct }: { revealed: boolean; answer: string; correct: boolean }) {
  if (!revealed) return <span className="mx-1 inline-block min-w-[5ch] border-b-[3px] border-accent">&nbsp;</span>;
  return (
    <span className={`mx-1 inline-block rounded-md px-2 font-bold ${correct ? 'bg-sage-ink/15 text-sage-ink' : 'bg-accent/15 text-accent'}`}>
      {answer}
    </span>
  );
}
