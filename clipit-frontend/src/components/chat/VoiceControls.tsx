import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { KeyboardIcon, MicIcon } from 'lucide-react';
import { Tooltip } from '../Tooltip';

interface VoiceControlsProps {
  /** The mic is open and streaming. */
  live: boolean;
  /** The tutor is actively speaking or listening right now (drives the level bars). */
  capturing: boolean;
  connecting: boolean;
  status: string;
  onStart: () => void;
  onStop: () => void;
  onType: () => void;
}

const BARS = [0, 1, 2, 3];

export function VoiceControls({
  live,
  capturing,
  connecting,
  status,
  onStart,
  onStop,
  onType,
}: VoiceControlsProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-6">
        <Tooltip label="Type">
          <button
            type="button"
            onClick={onType}
            aria-label="Type instead"
            className="grid size-9 place-items-center rounded-xl border border-subtle text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
          >
            <KeyboardIcon className="size-4" aria-hidden="true" />
          </button>
        </Tooltip>

        <div className="relative grid place-items-center">
          {live && !reduceMotion && (
            <motion.span
              className="absolute size-14 rounded-full border border-accent-ring"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}

          <button
            type="button"
            onClick={live ? onStop : onStart}
            disabled={connecting}
            aria-pressed={live}
            aria-label={live ? 'Stop the mic' : 'Start speaking'}
            className={`relative grid size-14 place-items-center rounded-full text-on-accent transition-colors duration-150 ease-swift disabled:opacity-70 ${
              live ? 'bg-accent-hover' : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {live ? (
              /* Stop square, with the live level moving behind it. */
              <span className="grid place-items-center">
                {capturing && !reduceMotion && (
                  <span className="absolute flex items-end gap-1" aria-hidden="true">
                    {BARS.map((bar) => (
                      <motion.span
                        key={bar}
                        className="w-0.5 rounded-full bg-on-accent/35"
                        animate={{ height: [6, 18, 10, 15, 6] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                          delay: bar * 0.1,
                        }}
                      />
                    ))}
                  </span>
                )}
                <span className="relative size-4 rounded-sm bg-on-accent" aria-hidden="true" />
              </span>
            ) : (
              <MicIcon className="size-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Keeps the mic optically centred against the Type button. */}
        <span className="size-9 shrink-0" aria-hidden="true" />
      </div>

      <p className="text-meta text-muted" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}
