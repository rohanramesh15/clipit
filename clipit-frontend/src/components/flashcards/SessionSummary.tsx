import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trophy } from 'lucide-react';

interface SessionStats {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

interface SessionSummaryProps {
  /** 'complete' is the normal end-of-session screen. 'goal-reached' fires when the daily card cap is hit mid-session. */
  variant: 'complete' | 'goal-reached';
  stats: SessionStats;
  /** Only used for the 'goal-reached' variant, e.g. "30 cards". */
  goalLabel?: string;
  onReviewAgain: () => void;
  onBackToDecks: () => void;
  /** Only used for the 'goal-reached' variant. */
  onKeepReviewing?: () => void;
}

const statCols: { key: keyof Omit<SessionStats, 'reviewed'>; label: string }[] = [
  { key: 'again', label: 'Again' },
  { key: 'hard', label: 'Hard' },
  { key: 'good', label: 'Good' },
  { key: 'easy', label: 'Easy' },
];

export function SessionSummary({
  variant,
  stats,
  goalLabel,
  onReviewAgain,
  onBackToDecks,
  onKeepReviewing,
}: SessionSummaryProps) {
  if (variant === 'goal-reached') {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-5 text-center sm:px-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-sand-soft"
        >
          <Sparkles className="h-10 w-10 text-sand-ink" aria-hidden="true" />
        </motion.div>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
        >
          <h2 className="font-heading text-card-title text-sand-deep">
            {stats.reviewed} cards — great work!
          </h2>
          {goalLabel && (
            <p className="mt-2 text-body-sm text-sand-ink">
              You hit your daily goal of {goalLabel}
            </p>
          )}
        </motion.div>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.16 }}
          className="mt-2 flex flex-col items-center gap-3"
        >
          <p className="text-body-sm text-sand-ink">Want to keep going?</p>
          <div className="flex gap-3">
            <button
              onClick={onBackToDecks}
              className="rounded-xl bg-white/70 px-5 py-2.5 text-body-sm font-semibold text-sand-deep transition-colors duration-150 ease-swift hover:bg-white"
            >
              I'm done for today
            </button>
            <button
              onClick={onKeepReviewing}
              className="rounded-xl bg-sand-ink px-5 py-2.5 text-body-sm font-semibold text-white transition-colors duration-150 ease-swift hover:bg-sand-deep"
            >
              Keep reviewing
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (stats.reviewed === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 text-center sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sand-soft">
          <Trophy className="h-8 w-8 text-sand-ink" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-card-title text-sand-deep">Session complete!</h2>
        <p className="text-body-sm text-sand-ink">
          No cards are due for review right now. Come back later!
        </p>
        <button
          onClick={onBackToDecks}
          className="mt-4 rounded-xl bg-sand-ink px-6 py-3 text-body font-semibold text-white transition-colors duration-150 ease-swift hover:bg-sand-deep"
        >
          Back to decks
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 text-center sm:px-8">
      <p className="font-heading text-[3rem] leading-none text-sand-deep">{stats.reviewed}</p>
      <p className="mt-3 text-body text-sand-ink">
        {stats.reviewed === 1 ? 'word reviewed' : 'words reviewed'}
      </p>

      <div className="mt-10 grid w-full grid-cols-4 gap-2 border-t border-sand-mid/60 pt-8">
        {statCols.map((col) => (
          <div key={col.key}>
            <p className="text-lead font-semibold text-sand-deep">{stats[col.key]}</p>
            <p className="mt-1 text-meta uppercase tracking-[0.08em] text-sand-ink">
              {col.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onReviewAgain}
          className="rounded-xl bg-sand-ink px-6 py-3 text-body font-semibold text-white transition-colors duration-150 ease-swift hover:bg-sand-deep"
        >
          Review all cards again
        </button>
        <button
          onClick={onBackToDecks}
          className="rounded-xl bg-white/70 px-6 py-3 text-body font-semibold text-sand-deep transition-colors duration-150 ease-swift hover:bg-white"
        >
          Back to decks
        </button>
      </div>
    </div>
  );
}
