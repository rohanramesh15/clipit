import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, Film, Lightbulb, PenLine, Play, RotateCcw, Search, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fetchTrackedVideos, fetchVideoCards, buildMadlibItems, fetchVideoWordCount, type MadlibItem, type TrackedVideo } from '../services/madlibs';
import { relativeDay } from '../utils/flashcardStorage';
import { saveMadlibProgress, clearMadlibProgress, getMostRecentMadlibProgress, type MadlibProgress } from '../utils/madlibsStorage';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';
import { LoadingAnimation } from '../components/LoadingAnimation';
import { NavigationIconButton } from '../components/NavigationIconButton';

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
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'words', label: 'Most words' },
  { value: 'recent', label: 'Recently watched' },
];

function isNetflix(videoId: string): boolean {
  return videoId.startsWith('netflix_');
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
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>('deck');
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('words');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sortRef = useRef<HTMLDivElement>(null);
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);
  const [items, setItems] = useState<MadlibItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [resumable, setResumable] = useState<MadlibProgress | null>(null);

  useEffect(() => {
    if (phase !== 'deck') return;
    setResumable(getMostRecentMadlibProgress(language));
  }, [phase, language]);

  useEffect(() => {
    if (phase !== 'playing' || !deck || items.length === 0 || answers.length === 0) return;
    saveMadlibProgress({
      videoId: deck.id,
      title: deck.title,
      language,
      items,
      answers: answers.map((a) => ({ chosen: a.chosen, correct: a.correct })),
      updatedAt: Date.now(),
    });
  }, [phase, deck, items, answers, language]);

  useEffect(() => {
    let alive = true;
    setVideos(null); setWordCounts({});
    void fetchTrackedVideos(language, token).then((nextVideos) => { if (alive) setVideos(nextVideos); });
    return () => { alive = false; };
  }, [language, token]);

  useEffect(() => {
    if (!videos?.length) return;
    let alive = true;
    void Promise.all(videos.map(async (video) => [video.video_id, await fetchVideoWordCount(video.video_id, language)] as const))
      .then((entries) => { if (alive) setWordCounts(Object.fromEntries(entries)); });
    return () => { alive = false; };
  }, [videos, language]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) setIsSortOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsSortOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const resetRound = () => { setIndex(0); setSelected(null); setRevealed(false); setShowHint(false); setAnswers([]); };

  const startDeck = useCallback(async (video: TrackedVideo) => {
    setDeck({ id: video.video_id, title: video.title });
    resetRound();
    setPhase('loading');
    setItems(buildMadlibItems(await fetchVideoCards(video.video_id, language)));
    setPhase('playing');
  }, [language]);

  const replay = useCallback(async () => {
    if (!deck) return;
    resetRound();
    setPhase('loading');
    setItems(buildMadlibItems(await fetchVideoCards(deck.id, language)));
    setPhase('playing');
  }, [deck, language]);

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
    clearMadlibProgress(language, progress.videoId);
    setResumable(null);
    void startDeck({ video_id: progress.videoId, title: progress.title, tracked_at: Date.now() });
  }, [language, startDeck]);

  const choose = useCallback((option: string) => {
    const item = items[index];
    if (revealed || !item) return;
    setSelected(option);
    setRevealed(true);
    setAnswers((prev) => [...prev, { item, chosen: option, correct: option === item.answer }]);
  }, [items, index, revealed]);

  const next = useCallback(() => {
    if (index + 1 >= items.length) {
      if (deck) clearMadlibProgress(language, deck.id);
      setPhase('done');
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
  }, [index, items.length, deck, language]);

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
      onClick={() => (target === 'practice' ? onNavigate('practice') : setPhase('deck'))}
    />
  );

  if (phase === 'deck') {
    const filtered = (videos ?? []).filter((v) => v.title.toLowerCase().includes(query.trim().toLowerCase()));
    const sorted = [...filtered].sort((a, b) =>
      sort === 'words' ? (wordCounts[b.video_id] ?? 0) - (wordCounts[a.video_id] ?? 0) : b.tracked_at - a.tracked_at,
    );
    const shown = sorted.slice(0, visible);
    const currentSort = SORTS.find((s) => s.value === sort) ?? SORTS[0];

    return (
      <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
        <div className="-ml-2 flex items-center gap-2">
          {back('practice')}
          <h1 className="font-heading text-section font-medium text-primary">Mad libs</h1>
        </div>

        {resumable && (
          <section className="mt-8 flex flex-wrap items-center gap-6 rounded-2xl bg-dusk-soft px-7 py-5" aria-labelledby="madlibs-continue">
            <VideoThumb video={{ video_id: resumable.videoId, title: resumable.title, tracked_at: 0 }} />
            <div className="min-w-0 flex-1">
              <p id="madlibs-continue" className="text-meta font-semibold uppercase tracking-wider text-dusk-ink">Continue</p>
              <p className="mt-1 truncate text-body font-semibold text-dusk-deep">{resumable.title}</p>
              <p className="mt-1 text-body-sm text-dusk-ink">{resumable.answers.length} of {resumable.items.length} blanks filled</p>
              <div className="mt-2 flex gap-1">
                {resumable.items.map((resumeItem, i) => (
                  <span key={resumeItem.id} className={`h-1.5 flex-1 rounded-full ${i < resumable.answers.length ? 'bg-accent' : 'bg-dusk-mid/40'}`} />
                ))}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-5">
              <button
                type="button"
                onClick={() => resumeDeck(resumable)}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
              >
                <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
                Resume
              </button>
              <button
                type="button"
                onClick={() => restartResumable(resumable)}
                className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-secondary transition-colors duration-150 ease-swift hover:text-primary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restart
              </button>
            </div>
          </section>
        )}

        <section className="mt-14" aria-labelledby="madlibs-library">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-subtle pb-4">
            <h2 id="madlibs-library" className="font-heading text-card-title text-primary">Your videos</h2>

            {videos !== null && videos.length > 0 && (
              <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                <label className="relative w-full max-w-xs">
                  <span className="sr-only">Search videos</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
                    placeholder="Search a video"
                    className="w-full rounded-xl border border-subtle bg-surface py-2.5 pl-9 pr-3 text-body-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </label>
                <div className="relative shrink-0" ref={sortRef}>
                  <button
                    type="button"
                    onClick={() => setIsSortOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isSortOpen}
                    className="flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
                  >
                    {currentSort.label}
                    <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isSortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    <span className="sr-only">Sort videos</span>
                  </button>
                  <AnimatePresence>
                    {isSortOpen && (
                      <motion.ul
                        role="listbox"
                        aria-label="Sort videos"
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                        className="absolute right-0 top-full z-20 mt-2 w-48 origin-top-right rounded-xl border border-subtle bg-app p-2 shadow-lg"
                      >
                        {SORTS.map((option) => {
                          const isSelected = option.value === sort;
                          return (
                            <li key={option.value} role="option" aria-selected={isSelected}>
                              <button
                                type="button"
                                onClick={() => { setSort(option.value); setVisible(PAGE_SIZE); setIsSortOpen(false); }}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-sm transition-colors duration-150 ease-swift ${
                                  isSelected ? 'bg-blush font-medium text-accent' : 'text-secondary hover:bg-surface-hover hover:text-primary'
                                }`}
                              >
                                <span className="flex-1 text-left">{option.label}</span>
                                {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                              </button>
                            </li>
                          );
                        })}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          {videos === null ? (
            <div className="space-y-3 pt-4" role="status" aria-live="polite">
              <div className="flex items-center gap-3 text-body-sm text-muted">
                <LoadingAnimation className="h-7 w-7" />
                Loading videos…
              </div>
              {[0, 1, 2].map((value) => (
                <div key={value} className="flex items-center gap-5 border-b border-subtle py-4">
                  <Skeleton className="h-14 w-24 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3 rounded" />
                    <Skeleton className="h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
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
                      <button
                        type="button"
                        onClick={() => ready && void startDeck(video)}
                        disabled={!ready}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-surface-hover px-3.5 py-2 text-body-sm font-semibold text-primary transition-colors duration-150 ease-swift enabled:hover:bg-blush disabled:opacity-40"
                      >
                        Practice
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
              {visible < sorted.length && (
                <button
                  type="button"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                  className="mt-6 w-full rounded-xl py-2.5 text-body-sm font-semibold text-muted transition-colors duration-150 ease-swift hover:text-primary"
                >
                  Show {Math.min(PAGE_SIZE, sorted.length - visible)} more of {sorted.length}
                </button>
              )}
            </>
          )}
        </section>
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
        <div className="-ml-2 flex items-center gap-2">
          {back('deck')}
          <h1 className="font-heading text-section font-medium text-primary">Mad libs</h1>
        </div>
        <div className="mx-auto mt-8 w-full max-w-2xl">
          <div className="mb-6 flex items-center gap-3 text-body-sm text-muted" role="status">
            <LoadingAnimation className="h-7 w-7" />
            Preparing your practice…
          </div>
          <Skeleton className="mb-8 h-2 w-full rounded-full" />
          <Skeleton className="mb-5 h-52 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((value) => <Skeleton key={value} className="h-14 rounded-xl" />)}
          </div>
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
          <button
            type="button"
            onClick={() => setPhase('deck')}
            className="mt-1 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            Pick another video
          </button>
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
              <button
                type="button"
                onClick={() => void replay()}
                className="rounded-xl bg-accent px-6 py-3 text-body font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
              >
                Play again
              </button>
              <button
                type="button"
                onClick={() => setPhase('deck')}
                className="rounded-xl border border-subtle bg-app px-6 py-3 text-body font-semibold text-primary transition-colors duration-150 ease-swift hover:bg-surface-hover"
              >
                Pick another video
              </button>
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
  const progress = ((index + (revealed ? 1 : 0)) / items.length) * 100;

  return (
    <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-4 sm:px-8">
      <header className="mx-auto flex w-full max-w-2xl shrink-0 items-center justify-between">
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
                  <button type="button" onClick={() => setShowHint(true)} className="inline-flex items-center gap-1.5 text-body-sm font-medium text-secondary hover:text-primary">
                    <Lightbulb className="h-4 w-4" />
                    Show hint
                  </button>
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
                  ? 'bg-sage-ink text-white'
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
                <button type="button" onClick={next} className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent hover:bg-accent-hover">
                  {index + 1 >= items.length ? 'Finish' : 'Next'}
                </button>
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
