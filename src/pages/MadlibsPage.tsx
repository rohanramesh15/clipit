import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, PenLine, Check, X, Lightbulb, RotateCcw, Sparkles,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { fetchMadlibItems, type MadlibItem } from '../services/madlibs';
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

type Phase = 'loading' | 'playing' | 'done';

export function MadlibsPage({ onNavigate }: MadlibsPageProps) {
  const { language } = useLanguage();
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<MadlibItem[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [correct, setCorrect] = useState(0);

  const load = useCallback(async () => {
    setPhase('loading');
    setIndex(0); setSelected(null); setRevealed(false); setShowHint(false); setCorrect(0);
    const data = await fetchMadlibItems(language);
    setItems(data);
    setPhase('playing');
  }, [language]);

  useEffect(() => { load(); }, [load]);

  const item = items[index];
  const isSample = items.some((i) => i.isSample);

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

  const backChip = (
    <button
      onClick={() => onNavigate('practice')}
      aria-label="Back to Practice"
      className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-white/5 transition-colors"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );

  // ── Loading (skeleton mirrors the real layout) ───────────
  if (phase === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          {backChip}
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full mb-10" />
        <Skeleton className="h-7 w-32 rounded-lg mb-6" />
        <div className="flex-1 max-w-2xl w-full mx-auto">
          <Skeleton className="h-44 w-full mb-5" style={{ borderRadius: 24 }} />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
            <Skeleton className="h-14 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Empty (shared across practice modes) ─────────────────
  if (phase === 'playing' && items.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="mb-8">{backChip}</div>
        <PracticeEmptyState onNavigate={onNavigate} />
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = items.length ? Math.round((correct / items.length) * 100) : 0;
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col">
        <div className="mb-8">{backChip}</div>
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto gap-5">
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
              <span className="font-semibold text-primary">{items.length}</span> sentences correctly ({pct}%).
            </p>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            These words now feed your spaced-repetition reviews.
          </p>
          <div className="flex gap-3 mt-1">
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
              style={{ background: ACCENT }}
            >
              <RotateCcw className="w-4 h-4" /> Play again
            </button>
            <button
              onClick={() => onNavigate('practice')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-surface border border-white/10 text-primary hover:bg-surface-hover transition-colors"
            >
              Back to Practice
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────
  const progress = ((index + (revealed ? 1 : 0)) / items.length) * 100;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {backChip}
        <div className="flex items-center gap-3">
          {isSample && (
            <span
              className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={{ background: hexA(ACCENT, 0.14), color: ACCENT }}
              title="Demo content — live items arrive once the backend endpoint is wired."
            >
              Sample round
            </span>
          )}
          <span className="text-sm font-medium text-secondary tabular-nums">
            {index + 1} / {items.length}
          </span>
        </div>
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

      {/* Title */}
      <div className="flex items-center gap-2 mb-6">
        <PenLine className="w-5 h-5" style={{ color: ACCENT }} />
        <h1 className="font-heading font-bold text-xl text-primary">Madlibs</h1>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-5">
                Fill the blank
              </p>
              <p className="font-heading text-2xl sm:text-3xl leading-snug text-primary">
                {item.before}
                <BlankSlot revealed={revealed} answer={item.answer} correct={selected === item.answer} />
                {item.after}
              </p>

              {/* Hint / translation */}
              <div className="mt-6 min-h-[24px]">
                {!revealed && (
                  showHint ? (
                    <p className="text-sm text-secondary">
                      Hint — the word means <span className="font-semibold text-primary">"{item.gloss}"</span>
                    </p>
                  ) : (
                    <button
                      onClick={() => setShowHint(true)}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:text-primary transition-colors"
                    >
                      <Lightbulb className="w-4 h-4" /> Show hint
                    </button>
                  )
                )}
                {revealed && (
                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-sm text-secondary italic"
                  >
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

            {/* Next */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-between mt-6"
                >
                  <span className="text-sm font-medium" style={{ color: selected === item.answer ? '#22c55e' : '#ef4444' }}>
                    {selected === item.answer ? 'Correct!' : `Answer: ${item.answer}`}
                  </span>
                  <button
                    onClick={next}
                    className="px-6 py-2.5 rounded-xl font-semibold text-sm text-white"
                    style={{ background: ACCENT }}
                  >
                    {index + 1 >= items.length ? 'Finish' : 'Next'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
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
