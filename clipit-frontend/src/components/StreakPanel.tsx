import React from 'react';
import { Flame } from 'lucide-react';
import type { ActivityDay } from './ActivityHeatmap';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface StreakPanelProps {
  streak: number;
  longestStreak: number;
  lastWeek: ActivityDay[];
}

export function StreakPanel({ streak, longestStreak, lastWeek }: StreakPanelProps) {
  return (
    <section aria-labelledby="streak-heading" className="rounded-2xl bg-blush p-7">
      <h2 id="streak-heading" className="flex items-center gap-2 text-body-sm font-semibold text-accent">
        <Flame className="h-4 w-4" aria-hidden="true" />
        Current streak
      </h2>

      <p className="mt-3 font-heading text-display-lg leading-none text-inverse">
        {streak}
        <span className="ml-2 align-baseline text-lead font-medium text-secondary">days</span>
      </p>

      <p className="mt-3 text-body-sm text-secondary">Longest run so far: {longestStreak} days</p>

      <ul className="mt-6 flex gap-2 border-t border-medium pt-5">
        {lastWeek.map((day, index) => (
          <li key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={`h-8 w-full rounded-md ${day.reviews > 0 ? 'bg-accent' : 'bg-app'}`}
              title={`${day.reviews} reviews`}
            />
            <span className="text-meta text-muted">{WEEKDAYS[index]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
