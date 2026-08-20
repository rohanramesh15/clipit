import React from 'react';
import { PlayIcon } from 'lucide-react';
import { TrackedVideo } from '../../types/flashcards';
import { Skeleton } from '../Skeleton';

interface DueTodayProps {
  videos: TrackedVideo[];
  /** video_id -> number of cards due for that video. Missing entries are treated as not-yet-known. */
  dueCounts: Record<string, number>;
  /** True while due counts are still being computed in the background. */
  isLoadingDue: boolean;
  onStartAll: () => void;
}

function thumbnailFor(video: TrackedVideo): string | null {
  if (video.video_id.startsWith('netflix_')) return null;
  return `https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`;
}

export function DueToday({ videos, dueCounts, isLoadingDue, onStartAll }: DueTodayProps) {
  if (isLoadingDue) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl bg-sand-soft px-7 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-12 w-40 rounded" />
          <Skeleton className="h-11 w-36 rounded-xl" />
        </div>
        <div className="flex -space-x-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-24 rounded-xl border-2 border-sand-soft" />
          ))}
        </div>
      </section>
    );
  }

  const withDue = videos.filter((video) => (dueCounts[video.video_id] ?? 0) > 0);
  const totalDue = withDue.reduce((sum, video) => sum + (dueCounts[video.video_id] ?? 0), 0);

  if (totalDue === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-2xl bg-sand-soft px-7 py-8" aria-labelledby="due-heading">
        <h2 id="due-heading" className="font-heading text-card-title text-sand-deep">
          Nothing due today
        </h2>
        <p className="text-body text-sand-ink">
          Your next words come back soon. Watch something and new ones will land here.
        </p>
      </section>
    );
  }

  const previewVideos = withDue.slice(0, 4);
  const hiddenVideos = withDue.length - previewVideos.length;

  return (
    <section
      className="flex flex-col gap-8 rounded-2xl bg-sand-soft px-7 py-8 sm:flex-row sm:items-center sm:justify-between"
      aria-labelledby="due-heading"
    >
      <div>
        <p className="text-meta font-semibold uppercase tracking-[0.08em] text-sand-ink">Due today</p>
        <h2 id="due-heading" className="mt-3 font-heading text-[3rem] leading-none text-sand-deep">
          {totalDue}
          <span className="ml-3 align-middle font-sans text-body text-sand-ink">
            {totalDue === 1 ? 'word' : 'words'} from {withDue.length}{' '}
            {withDue.length === 1 ? 'video' : 'videos'}
          </span>
        </h2>
        <button
          onClick={onStartAll}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sand-ink px-6 py-3 text-body font-semibold text-white transition-colors duration-150 ease-swift hover:bg-sand-deep"
        >
          <PlayIcon className="h-4 w-4" aria-hidden="true" />
          Start review
        </button>
      </div>

      <ul className="flex shrink-0 items-center -space-x-4" aria-hidden="true">
        {previewVideos.map((video) => {
          const thumb = thumbnailFor(video);
          return (
            <li key={video.video_id}>
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  className="h-16 w-24 rounded-xl border-2 border-sand-soft object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded-xl border-2 border-sand-soft bg-[#B20710]/10 text-body-sm font-bold text-[#B20710]">
                  N
                </div>
              )}
            </li>
          );
        })}
        {hiddenVideos > 0 && (
          <li className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-sand-soft bg-sand-mid text-body-sm font-semibold text-sand-deep">
            +{hiddenVideos}
          </li>
        )}
      </ul>
    </section>
  );
}
