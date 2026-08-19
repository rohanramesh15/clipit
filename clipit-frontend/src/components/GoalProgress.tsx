import React from 'react';
import { motion } from 'framer-motion';
import { Target, Trophy, Flame } from 'lucide-react';

interface GoalProgressProps {
  reviewed: number;
  goal: number;
}

export function GoalProgress({ reviewed, goal }: GoalProgressProps) {
  const reached = goal > 0 && reviewed >= goal;
  const over = reviewed > goal;
  const pct = goal > 0 ? Math.min(100, (reviewed / goal) * 100) : 0;
  const Icon = over ? Flame : reached ? Trophy : Target;
  const label = over ? "You're on fire!" : reached ? 'Daily goal reached' : "Today's goal";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-body-sm font-semibold text-primary">
          <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
          {label}
        </span>
        <span className="text-body-sm tabular-nums text-secondary">
          {reviewed} / {goal} cards
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-blush"
        role="progressbar"
        aria-valuenow={reviewed}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label="Cards reviewed toward today’s goal"
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        />
      </div>
    </div>
  );
}
