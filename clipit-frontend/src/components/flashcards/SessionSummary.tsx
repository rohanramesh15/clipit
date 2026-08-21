import React from 'react';
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
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-hover">
          <Sparkles className="h-10 w-10 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-card-title text-primary">
            {stats.reviewed} cards — great work!
          </h2>
          {goalLabel && (
            <p className="mt-2 text-body-sm text-secondary">
              You hit your daily goal of {goalLabel}
            </p>
          )}
        </div>
        <div className="mt-2 flex flex-col items-center gap-3">
          <p className="text-body-sm text-secondary">Want to keep going?</p>
          <div className="flex gap-3">
            <button
              onClick={onBackToDecks}
              className="rounded-xl border border-subtle bg-app px-5 py-2.5 text-body-sm font-semibold text-primary transition-colors duration-150 ease-swift hover:bg-surface-hover"
            >
              I'm done for today
            </button>
            <button
              onClick={onKeepReviewing}
              className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
            >
              Keep reviewing
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stats.reviewed === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 text-center sm:px-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
          <Trophy className="h-8 w-8 text-primary" aria-hidden="true" />
        </div>
        <h2 className="font-heading text-card-title text-primary">Session complete!</h2>
        <p className="text-body-sm text-secondary">
          No cards are due for review right now. Come back later!
        </p>
        <button
          onClick={onBackToDecks}
          className="mt-4 rounded-xl bg-accent px-6 py-3 text-body font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          Back to decks
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-5 text-center sm:px-8">
      <p className="font-heading text-[3rem] leading-none text-primary">{stats.reviewed}</p>
      <p className="mt-3 text-body text-secondary">
        {stats.reviewed === 1 ? 'word reviewed' : 'words reviewed'}
      </p>

      <div className="mt-10 grid w-full grid-cols-4 gap-2 border-t border-subtle pt-8">
        {statCols.map((col) => (
          <div key={col.key}>
            <p className="text-lead font-semibold text-primary">{stats[col.key]}</p>
            <p className="mt-1 text-meta uppercase tracking-[0.08em] text-muted">
              {col.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onReviewAgain}
          className="rounded-xl bg-accent px-6 py-3 text-body font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          Review all cards again
        </button>
        <button
          onClick={onBackToDecks}
          className="rounded-xl border border-subtle bg-app px-6 py-3 text-body font-semibold text-primary transition-colors duration-150 ease-swift hover:bg-surface-hover"
        >
          Back to decks
        </button>
      </div>
    </div>
  );
}
