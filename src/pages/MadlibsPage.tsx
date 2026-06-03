import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, PenLine, Check, X, Lightbulb, RotateCcw, Sparkles, Film, ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchTrackedVideos, fetchVideoCards, buildMadlibItems,
  type MadlibItem, type TrackedVideo,
} from '../services/madlibs';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';

type Page =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface MadlibsPageProps {
  onNavigate: (page: Page) => void;
}

// App accent (matches --accent in index.css, identical in light/dark).
const ACCENT = '#C4625A';
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

type Phase = 'deck' | 'loading' | 'playing' | 'done';

export function MadlibsPage({ onNavigate }: MadlibsPageProps) {
  const { language } = useLanguage();
  const { token } = useAuth();

  const [phase, setPhase] = useState<Phase>('deck');
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null); // null = loading list
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);

  const [items, setItems] = useState<MadlibItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [correct, setCorrect] = useState(0);

  // Load the user's tracked videos for the deck picker.
  useEffect(() => {
    let alive = true;
    setVideos(null);
    fetchTrackedVideos(language, token).then((v) => { if (alive) setVideos(v); });
    return () => { alive = false; };
  }, [language, token]);

  const startDeck = useCallback(async (video: TrackedVideo) => {
    setDeck({ id: video.video_id, title: video.title });
    setPhase('loading');
    setIndex(0); setSelected(null); setRevealed(false); setShowHint(false); setCorrect(0);
    const cards = await fetchVideoCards(video.video_id, language);
    setItems(buildMadlibItems(cards));
    setPhase('playing');
  }, [language]);

  const replay = useCallback(async () => {
    if (!deck) return;
    setPhase('loading');
    setIndex(0); setSelected(null); setRevealed(false); setShowHint(false); setCorrect(0);
    const cards = await fetchVideoCards(deck.id, language);
    setItems(buildMadlibItems(cards));
    setPhase('playing');
  }, [deck, language]);

  const item = items[index];

  const choose = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
    setRevealed(true);
    if (opt === item.answer) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (index + 1 >= items.length) { setPhase('done'); return; }
    setIndex((i) => i + 1);
    setSelected(null); setRevealed(false); setShowHint(false);
  };

  const backTo = (target: 'practice' | 'deck') => (
    <button
      onClick={() => (target === 'practice' ? onNavigate('practice') : setPhase('deck'))}
      aria-label={target === 'practice' ? 'Back to Practice' : 'Back to videos'}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );

  const title = (
    <div className="flex items-center gap-2">
      <PenLine className="w-5 h-5" style={{ color: ACCENT }} />
      <h1 className="font-heading font-bold text-xl text-primary">Mad Libs</h1>
    </div>
  );

  // ── Deck picker ───────────────────────────────────────────
  if (phase === 'deck') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          {backTo('practice')}
          {title}
        </div>
        <p className="text-secondary mb-8">
          Pick a video to fill in the blanks using the words it taught you.
        </p>

        {videos === null ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : videos.length === 0 ? (
          <PracticeEmptyState onNavigate={onNavigate} />
        ) : (
          <div className="space-y-3">
            {videos.map((v, i) => {
              const isNetflix = v.video_id.startsWith('netflix_');
              return (
                <motion.button
                  key={v.video_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => startDeck(v)}
                  className="group w-full flex items-center gap-4 bg-surface border border-white/5 rounded-2xl p-3 text-left hover:bg-surface-hover transition-colors"
                >
                  <span className="relative w-24 aspect-video shrink-0 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                    {isNetflix ? (
                      <Film className="w-5 h-5" style={{ color: ACCENT }} />
                    ) : (
                      <img
                        src={`https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-primary truncate">{v.title}</span>
                    <span className="block text-xs text-muted">Fill-in-the-blank practice</span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-muted group-hover:text-accent transition-colors" />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Loading a deck ────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">{backTo('deck')}{title}</div>
        <Skeleton className="h-1.5 w-full rounded-full mb-10" />
        <Skeleton className="h-44 w-full mb-5" style={{ borderRadius: 24 }} />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // ── No cloze items could be built for this video ──────────
  if (phase === 'playing' && items.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">{backTo('deck')}{title}</div>
        <div className="flex flex-col items-center justify-center text-center gap-4 py-16">
          <span className="inline-flex w-14 h-14 items-center justify-center rounded-2xl" style={{ background: hexA(ACCENT, 0.14), color: ACCENT }}>
            <PenLine className="w-7 h-7" />
          </span>
          <h2 className="font-heading font-bold text-xl text-primary">Not enough words here yet</h2>
          <p className="text-sm text-secondary max-w-sm">
            This video doesn't have enough example sentences to build Mad Libs. Try another video.
          </p>
          <button
            onClick={() => setPhase('deck')}
            className="mt-1 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{ background: ACCENT }}
          >
            Pick another video
          </button>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = items.length ? Math.round((correct / items.length) * 100) : 0;
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">{backTo('deck')}{title}</div>
        <div className="flex flex-col items-center justify-center text-center gap-5 py-12">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            className="inline-flex w-20 h-20 items-center justify-center rounded-3xl"
            style={{ background: hexA(ACCENT, 0.16), color: ACCENT }}
          >
            <Sparkles className="w-9 h-9" />
          </motion.span>
          <div>
            <h2 className="font-heading font-bold text-3xl text-primary">Nicely done.</h2>
            <p className="text-secondary mt-2">
              You filled <span className="font-semibold text-primary">{correct}</span> of{' '}
              <span className="font-semibold text-primary">{items.length}</span> correctly ({pct}%).
            </p>
            {deck && <p className="text-xs text-muted mt-1 truncate max-w-xs mx-auto">{deck.title}</p>}
          </div>
          <div className="flex gap-3 mt-1">
            <button onClick={replay} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: ACCENT }}>
              <RotateCcw className="w-4 h-4" /> Play again
            </button>
            <button onClick={() => setPhase('deck')} className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-surface border border-white/10 text-primary hover:bg-surface-hover transition-colors">
              Pick another video
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────
  const progress = ((index + (revealed ? 1 : 0)) / items.length) * 100;

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          {backTo('deck')}
          {title}
        </div>
        <span className="text-sm font-medium text-secondary tabular-nums shrink-0">
          {index + 1} / {items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: ACCENT }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Sentence card */}
          <div className="rounded-3xl bg-surface border border-white/10 p-7 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-5">Fill the blank</p>
            <p className="font-heading text-2xl sm:text-3xl leading-snug text-primary">
              {item.before}
              <BlankSlot revealed={revealed} answer={item.answer} correct={selected === item.answer} />
              {item.after}
            </p>

            <div className="mt-6 min-h-[24px]">
              {!revealed && (
                showHint ? (
                  <p className="text-sm text-secondary">
                    Hint — the word means <span className="font-semibold text-primary">"{item.gloss}"</span>
                  </p>
                ) : item.gloss ? (
                  <button onClick={() => setShowHint(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors">
                    <Lightbulb className="w-4 h-4" /> Show hint
                  </button>
                ) : null
              )}
              {revealed && item.translation && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-secondary italic">
                  {item.translation}
                </motion.p>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            {item.options.map((opt) => {
              const isAnswer = opt === item.answer;
              const isChosen = opt === selected;
              let cls = 'bg-surface border-white/10 text-primary hover:bg-surface-hover';
              let style: React.CSSProperties = {};
              if (revealed) {
                if (isAnswer) { cls = 'border-transparent text-white'; style = { background: '#22c55e' }; }
                else if (isChosen) { cls = 'border-transparent text-white'; style = { background: '#ef4444' }; }
                else cls = 'bg-surface border-white/10 text-muted opacity-60';
              }
              return (
                <motion.button
                  key={opt}
                  onClick={() => choose(opt)}
                  disabled={revealed}
                  whileTap={revealed ? undefined : { scale: 0.97 }}
                  animate={revealed && isChosen && !isAnswer ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  className={`relative flex items-center justify-center gap-2 rounded-2xl border px-4 py-4 font-semibold text-base transition-colors ${cls}`}
                  style={style}
                >
                  {revealed && isAnswer && <Check className="w-4 h-4" strokeWidth={3} />}
                  {revealed && isChosen && !isAnswer && <X className="w-4 h-4" strokeWidth={3} />}
                  {opt}
                </motion.button>
              );
            })}
          </div>

          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center justify-between mt-6"
              >
                <span className="text-sm font-medium" style={{ color: selected === item.answer ? '#22c55e' : '#ef4444' }}>
                  {selected === item.answer ? 'Correct!' : `Answer: ${item.answer}`}
                </span>
                <button onClick={next} className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white" style={{ background: ACCENT }}>
                  {index + 1 >= items.length ? 'Finish' : 'Next'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BlankSlot({ revealed, answer, correct }: { revealed: boolean; answer: string; correct: boolean }) {
  if (!revealed) {
    return (
      <span
        className="inline-block align-baseline mx-1 rounded-md"
        style={{ minWidth: '5ch', borderBottom: `3px solid ${hexA(ACCENT, 0.5)}` }}
      >
        &nbsp;
      </span>
    );
  }
  return (
    <span
      className="inline-block mx-1 px-2 rounded-md font-bold"
      style={{
        color: correct ? '#22c55e' : '#ef4444',
        background: correct ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      }}
    >
      {answer}
    </span>
  );
}
