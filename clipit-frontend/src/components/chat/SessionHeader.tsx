import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeftIcon,
  UsersIcon,
  MessageSquareTextIcon,
  MicIcon,
  PhoneOffIcon,
  Film,
} from 'lucide-react';
import { Tooltip } from '../Tooltip';
import type { TargetWord } from '../../types/chat';

interface SessionHeaderProps {
  title: string;
  subtitle: string;
  thumbnailVideoId: string | null;
  targets: TargetWord[];
  usedCount: number;
  coachOpen: boolean;
  onToggleCoach: () => void;
  transcriptOpen: boolean;
  onToggleTranscript: () => void;
  onLeave: () => void;
}

export function SessionHeader({
  title,
  subtitle,
  thumbnailVideoId,
  targets,
  usedCount,
  coachOpen,
  onToggleCoach,
  transcriptOpen,
  onToggleTranscript,
  onLeave,
}: SessionHeaderProps) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const isNetflix = thumbnailVideoId?.startsWith('netflix_');

  return (
    <header className="shrink-0 border-b border-subtle bg-app">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-4 px-5 sm:px-8">
        <Tooltip label="Back" placement="bottom">
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave practice"
            className="inline-flex shrink-0 items-center rounded-xl p-2 text-secondary transition-all duration-150 ease-swift hover:-translate-x-0.5 hover:text-primary"
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </button>
        </Tooltip>

        <span className="hidden h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-hover sm:flex">
          {isNetflix ? (
            <Film className="w-4 h-4 text-accent" />
          ) : thumbnailVideoId ? (
            <img
              src={`https://img.youtube.com/vi/${thumbnailVideoId}/mqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-heading text-body font-semibold text-primary">{title}</h1>
          <p className="truncate text-meta text-muted">{subtitle}</p>
        </div>

        {targets.length > 0 && (
          <div className="hidden items-center gap-3 md:flex">
            <div
              className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-hover"
              role="progressbar"
              aria-valuenow={usedCount}
              aria-valuemin={0}
              aria-valuemax={targets.length}
              aria-label="Words used this session"
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                animate={{ width: `${targets.length ? (usedCount / targets.length) * 100 : 0}%` }}
                transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              />
            </div>
            <p className="text-meta text-secondary">
              <span className="font-semibold text-primary">{usedCount}</span>/{targets.length} words
            </p>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <Tooltip label={transcriptOpen ? 'Back to call' : 'Transcript'} placement="bottom">
            <button
              type="button"
              onClick={onToggleTranscript}
              aria-pressed={transcriptOpen}
              aria-label={transcriptOpen ? 'Back to call' : 'Transcript'}
              className={`inline-flex items-center rounded-xl p-2 transition-colors duration-150 ease-swift ${
                transcriptOpen
                  ? 'bg-accent-soft text-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-primary'
              }`}
            >
              {transcriptOpen ? (
                <MicIcon className="size-5" aria-hidden="true" />
              ) : (
                <MessageSquareTextIcon className="size-5" aria-hidden="true" />
              )}
            </button>
          </Tooltip>

          <Tooltip label="Coach" placement="bottom">
            <button
              type="button"
              onClick={onToggleCoach}
              aria-pressed={coachOpen}
              aria-label="Coach"
              className={`inline-flex items-center rounded-xl p-2 transition-colors duration-150 ease-swift ${
                coachOpen
                  ? 'bg-accent-soft text-accent'
                  : 'text-secondary hover:bg-surface-hover hover:text-primary'
              }`}
            >
              <UsersIcon className="size-5" aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip label="End session" placement="bottom">
            <button
              type="button"
              onClick={onLeave}
              aria-label={`End session after ${elapsed}`}
              className="ml-1 inline-flex items-center gap-2 rounded-xl border border-subtle px-3 py-2 text-secondary transition-colors duration-150 ease-swift hover:border-medium hover:text-primary"
            >
              <PhoneOffIcon className="size-4" aria-hidden="true" />
              <span className="text-body-sm font-medium tabular-nums">{elapsed}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
