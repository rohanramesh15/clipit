import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export interface SegmentedTab<T extends string> {
  id: T;
  label: string;
  Icon?: LucideIcon;
  count?: number;
}

// A segmented pill control with a sliding accent indicator — the app's standard
// tab pattern. Used on Communities and Watch History. `layoutId` must be unique
// per mounted instance so the indicator animates within its own group.
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
  layoutId,
}: {
  tabs: SegmentedTab<T>[];
  active: T;
  onChange: (id: T) => void;
  layoutId: string;
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface">
      {tabs.map(({ id, label, Icon, count }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              isActive ? 'text-app' : 'text-secondary hover:text-primary'
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-accent"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            {Icon && <Icon className="w-4 h-4 relative z-10" />}
            <span className="relative z-10">{label}</span>
            {count !== undefined && (
              <span
                className={`relative z-10 text-xs px-1.5 py-0.5 rounded-full ${
                  isActive ? 'text-app bg-black/15' : 'text-muted bg-white/10'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
