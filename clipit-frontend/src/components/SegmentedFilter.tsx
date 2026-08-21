import React from 'react';
import { motion } from 'framer-motion';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  count: number;
}

interface SegmentedFilterProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedFilter<T extends string>({ options, value, onChange, label }: SegmentedFilterProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1 rounded-lg bg-surface p-1">
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            className={`relative flex items-center gap-2 rounded-md px-3.5 py-1.5 text-body-sm font-semibold transition-colors duration-150 ease-swift ${
              isActive ? 'text-accent' : 'text-secondary hover:text-primary'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="segment-pill"
                className="absolute inset-0 rounded-md selected-surface"
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              />
            )}
            <span className="relative">{option.label}</span>
            <span className="relative text-meta tabular-nums text-muted">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
