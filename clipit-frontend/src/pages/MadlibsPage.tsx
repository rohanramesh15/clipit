import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Check, ChevronRight, CircleCheck, Film, Lightbulb, Play,
  RotateCcw, Sparkles, X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchTrackedVideos, fetchVideoCards, buildMadlibItems, fetchVideoWordCount,
  type MadlibItem, type TrackedVideo,
} from '../services/madlibs';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';
import { LoadingAnimation } from '../components/LoadingAnimation';

type Page =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface MadlibsPageProps {
  onNavigate: (page: Page) => void;
}

type Phase = 'deck' | 'loading' | 'playing' | 'done';

function wordLabel(count: number | undefined) {
  if (count === undefined) return 'Counting words…';
  if (count === 0) return 'No practice words yet';
  return `${count} ${count === 1 ? 'word' : 'words'} ready`;
}

function VideoArtwork({ video, className = '' }: { video: TrackedVideo; className?: string }) {
  const isNetflix = video.video_id.startsWith('netflix_');

  return (
    <div className={`relative overflow-hidden bg-surface-hover ${className}`}>
      {isNetflix ? (
        <div className="flex h-full w-full items-center justify-center bg-[#B20710]/10">
          <Film className="h-6 w-6 text-[#B20710]" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
          alt=""
          className="h-full w-full object-cover"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      )}
      <span className="absolute left-3 top-3 rounded-lg bg-inverse/80 px-2 py-1 text-meta font-bold text-cream backdrop-blur-sm">
        {isNetflix ? 'Netflix' : 'YouTube'}
      </span>
    </div>
  );
}

export function MadlibsPage({ onNavigate }: MadlibsPageProps) {
  const { language } = useLanguage();
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>('deck');
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);
  const [items, setItems] = useState<MadlibItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [correct, setCorrect] = useState(0);

  useEffect(() => {
    let alive = true;
    setVideos(null);
    setWordCounts({});
    void fetchTrackedVideos(language, token).then((nextVideos) => {
      if (alive) setVideos(nextVideos);
    });
    return () => { alive = false; };
  }, [language, token]);

  useEffect(() => {
    if (!videos?.length) return;
    let alive = true;
    void Promise.all(
      videos.map(async (video) => [video.video_id, await fetchVideoWordCount(video.video_id, language)] as const),
    ).then((entries) => {
      if (alive) setWordCounts(Object.fromEntries(entries));
    });
    return () => { alive = false; };
  }, [videos, language]);

  const resetRound = () => {
    setIndex(0);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
    setCorrect(0);
  };

  const startDeck = useCallback(async (video: TrackedVideo) => {
    setDeck({ id: video.video_id, title: video.title });
    resetRound();
    setPhase('loading');
    const cards = await fetchVideoCards(video.video_id, language);
    setItems(buildMadlibItems(cards));
    setPhase('playing');
  }, [language]);

  const replay = useCallback(async () => {
    if (!deck) return;
    resetRound();
    setPhase('loading');
    const cards = await fetchVideoCards(deck.id, language);
    setItems(buildMadlibItems(cards));
    setPhase('playing');
  }, [deck, language]);

  const choose = (option: string) => {
    if (revealed || !items[index]) return;
    setSelected(option);
    setRevealed(true);
    if (option === items[index].answer) setCorrect((value) => value + 1);
  };

  const next = () => {
    if (index + 1 >= items.length) {
      setPhase('done');
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setRevealed(false);
    setShowHint(false);
  };

  const backButton = (target: 'practice' | 'deck', label: string) => (
    <button
      type="button"
      onClick={() => (target === 'practice' ? onNavigate('practice') : setPhase('deck'))}
      className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-body-sm font-semibold text-secondary hover:bg-surface hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );

  if (phase === 'deck') {
    const readyDecks = videos?.filter((video) => (wordCounts[video.video_id] ?? 0) > 0).length ?? 0;
    return (
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-page px-5 pb-16 pt-8 sm:px-8">
        <div className="mb-8">{backButton('practice', 'Practice')}</div>
        <section className="grid gap-8 rounded-2xl bg-dusk-soft px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-meta font-bold uppercase tracking-[0.14em] text-dusk-deep">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Practice mode
            </div>
            <h1 className="font-heading text-display text-dusk-deep sm:text-display-lg">Mad libs</h1>
            <p className="mt-3 max-w-xl text-body text-dusk-ink">
              Rebuild real lines from the videos you watched, one missing word at a time.
            </p>
          </div>
          <div className="flex gap-3 text-dusk-deep">
            <div className="min-w-28 rounded-xl bg-white/20 px-4 py-3">
              <p className="text-meta font-bold uppercase tracking-wide text-dusk-ink">Videos</p>
              <p className="mt-1 font-heading text-card-title">{videos?.length ?? '—'}</p>
            </div>
            <div className="min-w-28 rounded-xl bg-white/20 px-4 py-3">
              <p className="text-meta font-bold uppercase tracking-wide text-dusk-ink">Ready</p>
              <p className="mt-1 font-heading text-card-title">{videos === null ? '—' : readyDecks}</p>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="video-library-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-meta font-bold uppercase tracking-[0.14em] text-muted">Choose a source</p>
              <h2 id="video-library-heading" className="mt-1 font-heading text-section text-primary">Your video library</h2>
            </div>
            {videos && <p className="text-body-sm text-muted">Select a video to start a round</p>}
          </div>

          {videos === null ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">
              {[0, 1, 2].map((value) => (
                <div key={value} className="overflow-hidden rounded-2xl bg-surface p-4">
                  <Skeleton className="aspect-video w-full rounded-xl" />
                  <Skeleton className="mt-5 h-5 w-4/5 rounded-md" />
                  <Skeleton className="mt-2 h-4 w-2/5 rounded-md" />
                  <Skeleton className="mt-6 h-11 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <PracticeEmptyState onNavigate={onNavigate} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video, position) => {
                const count = wordCounts[video.video_id];
                const ready = (count ?? 0) > 0;
                return (
                  <motion.article
                    key={video.video_id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(position * 0.035, 0.24), duration: 0.22 }}
                    className="flex overflow-hidden rounded-2xl bg-surface"
                  >
                    <button
                      type="button"
                      onClick={() => ready && void startDeck(video)}
                      disabled={!ready}
                      className="group flex w-full flex-col text-left disabled:cursor-not-allowed"
                    >
                      <VideoArtwork video={video} className="aspect-video w-full" />
                      <span className="flex flex-1 flex-col p-5">
                        <span className="line-clamp-2 font-heading text-card-title text-primary">{video.title}</span>
                        <span className={`mt-2 text-body-sm font-semibold ${ready ? 'text-dusk-ink' : 'text-muted'}`}>
                          {wordLabel(count)}
                        </span>
                        <span className={`mt-6 inline-flex items-center justify-between rounded-xl px-4 py-3 text-body-sm font-bold ${ready ? 'bg-dusk-soft text-dusk-deep group-hover:bg-dusk-mid' : 'bg-surface-hover text-muted'}`}>
                          {ready ? 'Practice this video' : 'Needs more words'}
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </span>
                      </span>
                    </button>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    );
  }

  if (phase === 'loading') {
    return (
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-5 pb-16 pt-8 sm:px-8">
        <div className="mb-8">{backButton('deck', 'All videos')}</div>
        <section className="rounded-2xl bg-surface p-6 sm:p-8" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-body-sm font-semibold text-secondary">
            <LoadingAnimation className="h-8 w-8" />
            Preparing your round…
          </div>
          <Skeleton className="mt-8 h-2 w-full rounded-full" />
          <Skeleton className="mt-8 h-52 w-full rounded-2xl" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((value) => <Skeleton key={value} className="h-14 rounded-xl" />)}
          </div>
        </section>
      </main>
    );
  }

  if (phase === 'playing' && items.length === 0) {
    return (
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-5 pb-16 pt-8 sm:px-8">
        <div className="mb-8">{backButton('deck', 'All videos')}</div>
        <section className="flex flex-col items-center rounded-2xl bg-surface px-6 py-16 text-center sm:px-10">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-dusk-soft text-dusk-deep">
            <BookOpen className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-6 font-heading text-section text-primary">This one needs a little more material.</h1>
          <p className="mt-3 max-w-md text-body text-secondary">
            We couldn’t build enough complete sentences from this video yet. Try another video after watching a little more.
          </p>
          <button type="button" onClick={() => setPhase('deck')} className="mt-7 rounded-xl bg-accent px-5 py-3 text-body-sm font-bold text-on-accent hover:bg-accent-hover">
            Choose another video
          </button>
        </section>
      </main>
    );
  }

  if (phase === 'done') {
    const percentage = items.length ? Math.round((correct / items.length) * 100) : 0;
    return (
      <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-5 pb-16 pt-8 sm:px-8">
        <div className="mb-8">{backButton('deck', 'All videos')}</div>
        <section className="flex flex-col items-center rounded-2xl bg-dusk-soft px-6 py-14 text-center sm:px-10">
          <span className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-dusk-deep">
            <Sparkles className="h-9 w-9" aria-hidden="true" />
          </span>
          <p className="mt-7 text-meta font-bold uppercase tracking-[0.14em] text-dusk-ink">Round complete</p>
          <h1 className="mt-2 font-heading text-display text-dusk-deep">Nicely done.</h1>
          <p className="mt-3 text-body text-dusk-ink">
            You got <strong className="text-dusk-deep">{correct} of {items.length}</strong> correct — {percentage}%.
          </p>
          {deck && <p className="mt-2 max-w-md truncate text-body-sm text-dusk-ink">From {deck.title}</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => void replay()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-body-sm font-bold text-on-accent hover:bg-accent-hover">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Play again
            </button>
            <button type="button" onClick={() => setPhase('deck')} className="rounded-xl bg-white/20 px-5 py-3 text-body-sm font-bold text-dusk-deep hover:bg-white/20">
              Choose another video
            </button>
          </div>
        </section>
      </main>
    );
  }

  const item = items[index];
  const progress = ((index + (revealed ? 1 : 0)) / items.length) * 100;

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-3xl px-5 pb-16 pt-8 sm:px-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          {backButton('deck', 'All videos')}
          <p className="mt-5 text-meta font-bold uppercase tracking-[0.14em] text-muted">Mad libs</p>
          <h1 className="mt-1 truncate font-heading text-section text-primary">{deck?.title}</h1>
        </div>
        <div className="rounded-xl bg-surface px-4 py-3 text-right">
          <p className="text-meta font-bold uppercase tracking-wide text-muted">Sentence</p>
          <p className="mt-0.5 font-heading text-card-title text-primary">{index + 1}<span className="text-secondary"> / {items.length}</span></p>
        </div>
      </header>

      <div className="mb-8 h-2 overflow-hidden rounded-full bg-surface-hover" aria-label={`${Math.round(progress)}% complete`}>
        <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} transition={{ duration: 0.35, ease: 'easeOut' }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={item.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
          <article className="rounded-2xl bg-surface p-6 sm:p-9">
            <div className="flex items-center gap-2 text-meta font-bold uppercase tracking-[0.14em] text-muted">
              <BookOpen className="h-4 w-4 text-dusk-ink" aria-hidden="true" />
              Complete the line
            </div>
            <p className="mt-7 font-heading text-[1.75rem] leading-snug text-primary sm:text-[2.3rem]">
              {item.before}
              <BlankSlot revealed={revealed} answer={item.answer} correct={selected === item.answer} />
              {item.after}
            </p>
            <div className="mt-7 min-h-6">
              {!revealed && (showHint ? (
                <p className="text-body-sm text-secondary">Hint: it means <strong className="text-primary">“{item.gloss}”</strong></p>
              ) : item.gloss ? (
                <button type="button" onClick={() => setShowHint(true)} className="inline-flex items-center gap-2 text-body-sm font-bold text-secondary hover:text-primary">
                  <Lightbulb className="h-4 w-4 text-accent" aria-hidden="true" />
                  Show a hint
                </button>
              ) : null)}
              {revealed && item.translation && <p className="text-body-sm italic text-secondary">{item.translation}</p>}
            </div>
          </article>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {item.options.map((option) => {
              const isAnswer = option === item.answer;
              const isChosen = option === selected;
              const state = revealed
                ? isAnswer ? 'bg-success text-white' : isChosen ? 'bg-error text-white' : 'bg-surface text-muted opacity-55'
                : 'bg-surface text-primary hover:bg-surface-hover';
              return (
                <motion.button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  disabled={revealed}
                  whileTap={revealed ? undefined : { scale: 0.98 }}
                  animate={revealed && isChosen && !isAnswer ? { x: [0, -5, 5, -3, 3, 0] } : { x: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex min-h-16 items-center justify-center gap-2 rounded-xl px-5 py-4 text-center text-body font-bold ${state}`}
                >
                  {revealed && isAnswer && <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
                  {revealed && isChosen && !isAnswer && <X className="h-4 w-4" strokeWidth={3} aria-hidden="true" />}
                  {option}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {revealed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4">
                <span className={`inline-flex items-center gap-2 text-body-sm font-bold ${selected === item.answer ? 'text-success' : 'text-error'}`}>
                  {selected === item.answer ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : <X className="h-4 w-4" aria-hidden="true" />}
                  {selected === item.answer ? 'That’s right.' : `The answer is ${item.answer}.`}
                </span>
                <button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-body-sm font-bold text-on-accent hover:bg-accent-hover">
                  {index + 1 >= items.length ? 'Finish round' : 'Next sentence'}
                  {index + 1 < items.length && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </AnimatePresence>
    </main>
  );
}

function BlankSlot({ revealed, answer, correct }: { revealed: boolean; answer: string; correct: boolean }) {
  if (!revealed) {
    return <span className="mx-1 inline-block min-w-[5ch] align-baseline border-b-[3px] border-accent">&nbsp;</span>;
  }
  const style: CSSProperties = {
    background: correct ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
  };
  return <span className={`mx-1 inline-block rounded-lg px-2 font-bold ${correct ? 'text-success' : 'text-error'}`} style={style}>{answer}</span>;
}
