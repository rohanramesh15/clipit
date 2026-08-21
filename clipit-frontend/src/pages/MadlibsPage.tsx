import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Film, Lightbulb, PenLine, RotateCcw, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fetchTrackedVideos, fetchVideoCards, buildMadlibItems, fetchVideoWordCount, type MadlibItem, type TrackedVideo } from '../services/madlibs';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';
import { LoadingAnimation } from '../components/LoadingAnimation';

type Page = 'video' | 'practice' | 'flashcards' | 'analytics' | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';
interface MadlibsPageProps { onNavigate: (page: Page) => void; }
type Phase = 'deck' | 'loading' | 'playing' | 'done';

function VideoThumb({ video }: { video: TrackedVideo }) {
  if (video.video_id.startsWith('netflix_')) {
    return <span className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-[#B20710]/10"><Film className="h-5 w-5 text-[#B20710]" /></span>;
  }
  return <img src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />;
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

  const resetRound = () => { setIndex(0); setSelected(null); setRevealed(false); setShowHint(false); setCorrect(0); };
  const startDeck = useCallback(async (video: TrackedVideo) => {
    setDeck({ id: video.video_id, title: video.title }); resetRound(); setPhase('loading');
    setItems(buildMadlibItems(await fetchVideoCards(video.video_id, language))); setPhase('playing');
  }, [language]);
  const replay = useCallback(async () => {
    if (!deck) return;
    resetRound(); setPhase('loading'); setItems(buildMadlibItems(await fetchVideoCards(deck.id, language))); setPhase('playing');
  }, [deck, language]);
  const choose = (option: string) => {
    const item = items[index];
    if (revealed || !item) return;
    setSelected(option); setRevealed(true); if (option === item.answer) setCorrect((value) => value + 1);
  };
  const next = () => {
    if (index + 1 >= items.length) { setPhase('done'); return; }
    setIndex((value) => value + 1); setSelected(null); setRevealed(false); setShowHint(false);
  };
  const back = (target: 'practice' | 'deck') => (
    <button type="button" onClick={() => target === 'practice' ? onNavigate('practice') : setPhase('deck')} aria-label={target === 'practice' ? 'Back to Practice' : 'Back to videos'} className="inline-flex items-center rounded-xl p-2 text-secondary transition-colors duration-150 ease-swift hover:text-primary">
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  if (phase === 'deck') {
    return <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
      <div className="-ml-2 flex items-center gap-2">
        {back('practice')}<h1 className="font-heading text-section font-medium text-primary">Mad libs</h1>
      </div>
      <section className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-dusk-soft px-7 py-5" aria-labelledby="madlibs-intro">
        <h2 id="madlibs-intro" className="font-heading text-lead text-dusk-deep">Fill in the blanks</h2>
        <p className="text-body-sm text-dusk-ink">Practice words in the real sentences from videos you watched.</p>
      </section>
      <section className="mt-14" aria-labelledby="madlibs-library">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-subtle pb-4">
          <h2 id="madlibs-library" className="font-heading text-card-title text-primary">Your videos</h2>
          {videos && <p className="text-body-sm text-muted">Choose a video to begin</p>}
        </div>
        {videos === null ? <div className="space-y-3 pt-4" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-body-sm text-muted"><LoadingAnimation className="h-7 w-7" />Loading videos…</div>
          {[0, 1, 2].map((value) => <div key={value} className="flex items-center gap-5 border-b border-subtle py-4"><Skeleton className="h-14 w-24 shrink-0 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3 rounded" /><Skeleton className="h-3 w-1/3 rounded" /></div></div>)}
        </div> : videos.length === 0 ? <div className="py-12"><PracticeEmptyState onNavigate={onNavigate} /></div> : <ul>
          {videos.map((video, position) => {
            const count = wordCounts[video.video_id]; const ready = (count ?? 0) > 0;
            return <motion.li key={video.video_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(position * 0.03, 0.2) }} className="flex items-center gap-5 border-b border-subtle py-4">
              <VideoThumb video={video} />
              <div className="min-w-0 flex-1"><p className="truncate text-body font-semibold text-primary">{video.title}</p><p className="mt-0.5 truncate text-body-sm text-muted">{count === undefined ? 'Counting words…' : count === 0 ? 'No practice words yet' : `${count} ${count === 1 ? 'word' : 'words'} ready to practice`}</p></div>
              <button type="button" onClick={() => ready && void startDeck(video)} disabled={!ready} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-surface-hover px-3.5 py-2 text-body-sm font-semibold text-primary transition-colors duration-150 ease-swift enabled:hover:bg-blush disabled:opacity-40">
                Practice <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.li>;
          })}
        </ul>}
      </section>
    </main>;
  }

  if (phase === 'loading') return <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8"><div className="-ml-2 flex items-center gap-2">{back('deck')}<h1 className="font-heading text-section font-medium text-primary">Mad libs</h1></div><div className="mx-auto mt-8 w-full max-w-2xl"><div className="mb-6 flex items-center gap-3 text-body-sm text-muted" role="status"><LoadingAnimation className="h-7 w-7" />Preparing your practice…</div><Skeleton className="mb-8 h-2 w-full rounded-full" /><Skeleton className="mb-5 h-52 w-full rounded-2xl" /><div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map((value) => <Skeleton key={value} className="h-14 rounded-xl" />)}</div></div></main>;

  if (phase === 'playing' && items.length === 0) return <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8"><div className="-ml-2 flex items-center gap-2">{back('deck')}<h1 className="font-heading text-section font-medium text-primary">Mad libs</h1></div><div className="flex flex-col items-center gap-4 py-16 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover text-primary"><PenLine className="h-6 w-6" /></span><h2 className="font-heading text-card-title text-primary">Not enough words here yet</h2><p className="max-w-sm text-body-sm text-secondary">This video doesn’t have enough example sentences to build Mad Libs. Try another video.</p><button type="button" onClick={() => setPhase('deck')} className="mt-1 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent hover:bg-accent-hover">Pick another video</button></div></main>;

  if (phase === 'done') {
    const percentage = items.length ? Math.round((correct / items.length) * 100) : 0;
    return <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8"><div className="-ml-2 flex items-center gap-2">{back('deck')}<h1 className="font-heading text-section font-medium text-primary">Mad libs</h1></div><div className="flex flex-col items-center gap-5 py-12 text-center"><motion.span initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover text-accent"><Sparkles className="h-7 w-7" /></motion.span><div><h2 className="font-heading text-section text-primary">Nicely done.</h2><p className="mt-2 text-body text-secondary">You filled <strong className="text-primary">{correct}</strong> of <strong className="text-primary">{items.length}</strong> correctly ({percentage}%).</p>{deck && <p className="mt-1 max-w-sm truncate text-body-sm text-muted">{deck.title}</p>}</div><div className="flex gap-3"><button type="button" onClick={() => void replay()} className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent hover:bg-accent-hover"><RotateCcw className="h-4 w-4" />Play again</button><button type="button" onClick={() => setPhase('deck')} className="rounded-xl bg-surface-hover px-5 py-2.5 text-body-sm font-semibold text-primary hover:bg-blush">Pick another video</button></div></div></main>;
  }

  const item = items[index]; const progress = ((index + (revealed ? 1 : 0)) / items.length) * 100;
  return <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-4 sm:px-8">
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">{back('deck')}<p className="truncate text-body-sm font-semibold text-secondary">{deck?.title}</p></div>
      <span className="shrink-0 text-body-sm font-medium tabular-nums text-secondary">{index + 1} / {items.length}</span>
    </header>
    <div className="mx-auto mt-4 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-surface-hover"><motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} /></div>
    <AnimatePresence mode="wait"><motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }} className="mx-auto mt-8 w-full max-w-2xl">
      <article className="rounded-2xl border border-subtle bg-surface p-7 sm:p-9"><p className="text-meta font-semibold uppercase tracking-wider text-muted">Fill the blank</p><p className="mt-5 font-heading text-2xl leading-snug text-primary sm:text-3xl">{item.before}<BlankSlot revealed={revealed} answer={item.answer} correct={selected === item.answer} />{item.after}</p><div className="mt-6 min-h-6">{!revealed && (showHint ? <p className="text-body-sm text-secondary">Hint — the word means <strong className="text-primary">“{item.gloss}”</strong></p> : item.gloss ? <button type="button" onClick={() => setShowHint(true)} className="inline-flex items-center gap-1.5 text-body-sm font-medium text-secondary hover:text-primary"><Lightbulb className="h-4 w-4" />Show hint</button> : null)}{revealed && item.translation && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-body-sm italic text-secondary">{item.translation}</motion.p>}</div></article>
      <div className="mt-5 grid grid-cols-2 gap-3">{item.options.map((option) => { const answer = option === item.answer; const chosen = option === selected; const state = revealed ? answer ? 'bg-success text-white' : chosen ? 'bg-error text-white' : 'bg-surface text-muted opacity-60' : 'bg-surface text-primary hover:bg-surface-hover'; return <motion.button key={option} type="button" onClick={() => choose(option)} disabled={revealed} whileTap={revealed ? undefined : { scale: 0.98 }} animate={revealed && chosen && !answer ? { x: [0, -5, 5, 0] } : {}} className={`flex min-h-14 items-center justify-center gap-2 rounded-xl px-4 py-4 text-body font-semibold ${state}`}>{revealed && answer && <Check className="h-4 w-4" strokeWidth={3} />}{revealed && chosen && !answer && <X className="h-4 w-4" strokeWidth={3} />}{option}</motion.button>; })}</div>
      <AnimatePresence>{revealed && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex items-center justify-between gap-4"><span className={`text-body-sm font-semibold ${selected === item.answer ? 'text-success' : 'text-error'}`}>{selected === item.answer ? 'Correct!' : `Answer: ${item.answer}`}</span><button type="button" onClick={next} className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent hover:bg-accent-hover">{index + 1 >= items.length ? 'Finish' : 'Next'}</button></motion.div>}</AnimatePresence>
    </motion.div></AnimatePresence>
  </main>;
}

function BlankSlot({ revealed, answer, correct }: { revealed: boolean; answer: string; correct: boolean }) {
  if (!revealed) return <span className="mx-1 inline-block min-w-[5ch] border-b-[3px] border-accent">&nbsp;</span>;
  const style: CSSProperties = { background: correct ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)' };
  return <span className={`mx-1 inline-block rounded-md px-2 font-bold ${correct ? 'text-success' : 'text-error'}`} style={style}>{answer}</span>;
}
