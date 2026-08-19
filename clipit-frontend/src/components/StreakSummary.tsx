import React from 'react';
import { Flame } from 'lucide-react';

interface StreakSummaryProps {
  dueCount: number;
  streakDays: number;
}

export function StreakSummary({ dueCount, streakDays }: StreakSummaryProps) {
  return (
    <p className="flex items-center gap-2 text-body-sm font-medium text-secondary">
      {dueCount} words due
      <span aria-hidden="true" className="text-muted">
        ·
      </span>
      <Flame className="h-4 w-4 text-accent" strokeWidth={1.75} aria-hidden="true" />
      {streakDays}-day streak
    </p>
  );
}
