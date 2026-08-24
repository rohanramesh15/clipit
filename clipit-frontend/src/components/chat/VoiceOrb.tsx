import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type OrbState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface VoiceOrbProps {
  state: OrbState;
  initial: string;
}

const BARS = [0, 1, 2, 3, 4];

export function VoiceOrb({ state, initial }: VoiceOrbProps) {
  const reduceMotion = useReducedMotion();
  const live = state === 'listening' || state === 'speaking';

  return (
    <div className="relative grid size-24 shrink-0 place-items-center" aria-hidden="true">
      {live && !reduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full border border-accent-ring"
          animate={{ scale: [1, 1.28], opacity: [0.55, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <motion.span
        className={`grid size-16 place-items-center rounded-full ${
          state === 'speaking' ? 'bg-accent' : 'bg-accent-soft'
        }`}
        animate={
          reduceMotion || state === 'idle'
            ? { scale: 1 }
            : { scale: state === 'thinking' ? [1, 1.03, 1] : [1, 1.05, 1] }
        }
        transition={{ duration: state === 'thinking' ? 2.2 : 1.6, repeat: Infinity, ease: 'linear' }}
      >
        {state === 'speaking' ? (
          <span className="flex items-end gap-1">
            {BARS.map((bar) => (
              <motion.span
                key={bar}
                className="w-0.5 rounded-full bg-on-accent"
                animate={reduceMotion ? { height: 10 } : { height: [6, 18, 10, 14, 6] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'linear', delay: bar * 0.09 }}
              />
            ))}
          </span>
        ) : (
          <span className="font-heading text-lead font-medium text-accent">{initial}</span>
        )}
      </motion.span>
    </div>
  );
}
