import React, { useEffect, useState } from 'react';
import {
  ChevronLeftIcon,
  UsersIcon,
  MessageSquareTextIcon,
  MicIcon,
  PhoneOffIcon,
  Film,
} from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { WordProgressControl } from './WordProgressRail';
import type { TargetWord } from '../../types/chat';

interface SessionHeaderProps {
  title: string;
  subtitle: string;
  thumbnailVideoId: string | null;
  /** Mixed-practice sessions draw from several videos — a random sample of
   * those shown stacked instead of the single thumbnail above. */
  stackedVideos?: { video_id: string; title: string }[];
  targets: TargetWord[];
  usedLemmas: Set<string>;
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
  stackedVideos = [],
  targets,
  usedLemmas,
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
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave practice"
            className="inline-flex shrink-0 items-center rounded-xl p-2 text-secondary transition-all duration-150 ease-swift hover:-translate-x-0.5 hover:text-primary"
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </button>

          {stackedVideos.length > 0 ? (
          <ul
            className="hidden shrink-0 items-center -space-x-3 sm:flex"
            aria-label={`Words drawn from ${stackedVideos.map((v) => v.title).join(', ')}`}
          >
            {stackedVideos.map((v) => {
              const netflix = v.video_id.startsWith('netflix_');
              return (
                <li
                  key={v.video_id}
                  title={v.title}
                  className="h-9 w-14 shrink-0 overflow-hidden rounded-lg border-2 border-app bg-surface-hover"
                >
                  {netflix ? (
                    <div className="flex h-full w-full items-center justify-center bg-[#B20710]/10">
                      <Film className="h-3.5 w-3.5 text-[#B20710]" aria-hidden="true" />
                    </div>
                  ) : (
                    <img
                      src={`https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          ) : (
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
          )}

          <div className="min-w-0 max-w-[9rem] sm:max-w-[12rem] md:max-w-[15rem]">
            <h1 className="truncate font-heading text-body font-semibold text-primary">
              {transcriptOpen ? 'Transcript' : title}
            </h1>
            <p className="truncate text-meta text-muted">{subtitle}</p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <WordProgressControl targets={targets} usedLemmas={usedLemmas} />
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
