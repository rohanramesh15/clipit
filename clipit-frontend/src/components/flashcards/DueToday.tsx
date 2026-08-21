import React from 'react';
import { ChevronRight, PlayIcon } from 'lucide-react';
import { TrackedVideo } from '../../types/flashcards';
import { Skeleton } from '../Skeleton';

interface DueTodayProps {
  videos: TrackedVideo[];
  /** video_id -> number of cards due for that video. Missing entries are treated as not-yet-known. */
  dueCounts: Record<string, number>;
  /** True while due counts are still being computed in the background. */
  isLoadingDue: boolean;
  onStartAll: () => void;
  onStartVideo: (videoId: string, title: string) => void;
}

function thumbnailFor(video: TrackedVideo): string | null {
  if (video.video_id.startsWith('netflix_')) return null;
  return `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`;
}

export function DueToday({ videos, dueCounts, isLoadingDue, onStartAll, onStartVideo }: DueTodayProps) {
  if (isLoadingDue) {
    return (
      <section className="grid gap-10 rounded-2xl bg-blush px-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-14 w-48 rounded" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <div className="space-y-2 rounded-xl bg-app/60 p-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  const withDue = [...videos]
    .filter((video) => (dueCounts[video.video_id] ?? 0) > 0)
    .sort((a, b) => (dueCounts[b.video_id] ?? 0) - (dueCounts[a.video_id] ?? 0));
  const totalDue = withDue.reduce((sum, video) => sum + (dueCounts[video.video_id] ?? 0), 0);

  if (totalDue === 0) {
    return (
      <section
        className="flex flex-col items-start gap-3 rounded-2xl bg-blush px-8 py-10"
        aria-labelledby="due-heading"
      >
        <p className="text-meta font-semibold uppercase tracking-[0.08em] text-secondary">Due today</p>
        <h2 id="due-heading" className="font-heading text-section text-primary">
          Nothing to review
        </h2>
        <p className="max-w-sm text-body text-secondary">
          Your next words come back soon. Watch something and the words you pick will land here.
        </p>
      </section>
    );
  }

  const topVideos = withDue.slice(0, 3);
  const hiddenVideos = withDue.length - topVideos.length;

  return (
    <section
      className="grid gap-10 rounded-2xl bg-blush px-8 py-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center"
      aria-labelledby="due-heading"
    >
      <div>
        <p className="text-meta font-semibold uppercase tracking-[0.08em] text-secondary">Due today</p>
        <h2 id="due-heading" className="mt-4 flex items-baseline gap-3 font-heading text-[3.5rem] leading-none text-primary">
          {totalDue}
          <span className="font-sans text-body font-normal text-secondary">
            {totalDue === 1 ? 'word' : 'words'} across {withDue.length} {withDue.length === 1 ? 'video' : 'videos'}
          </span>
        </h2>
        <button
          onClick={onStartAll}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-body font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          <PlayIcon className="h-4 w-4" aria-hidden="true" />
          Start review
        </button>
        <p className="mt-3 text-meta text-secondary">Mixed across every video, in scheduled order</p>
      </div>

      <div className="rounded-xl bg-app/60 p-2">
        <ul>
          {topVideos.map((video) => {
            const thumb = thumbnailFor(video);
            return (
              <li key={video.video_id}>
                <button
                  onClick={() => onStartVideo(video.video_id, video.title)}
                  className="group flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-150 ease-swift hover:bg-app"
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-10 w-16 shrink-0 rounded-md object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-[#B20710]/10 text-meta font-bold text-[#B20710]">
                      N
                    </div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-sm font-medium text-primary">{video.title}</span>
                    <span className="mt-0.5 block text-meta text-secondary">
                      {dueCounts[video.video_id] ?? 0} due
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-secondary transition-transform duration-150 ease-swift group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
        {hiddenVideos > 0 && (
          <p className="px-2 pb-1 pt-2 text-meta text-secondary">
            +{hiddenVideos} more {hiddenVideos === 1 ? 'video' : 'videos'} with words due
          </p>
        )}
      </div>
    </section>
  );
}
