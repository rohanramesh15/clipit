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
    return <Skeleton className="h-[4.75rem] rounded-2xl" />;
  }

  const withDue = [...videos]
    .filter((video) => (dueCounts[video.video_id] ?? 0) > 0)
    .sort((a, b) => (dueCounts[b.video_id] ?? 0) - (dueCounts[a.video_id] ?? 0));
  const totalDue = withDue.reduce((sum, video) => sum + (dueCounts[video.video_id] ?? 0), 0);

  if (totalDue === 0) {
    return (
      <section
        className="flex min-h-24 flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-sand-soft px-7 py-5 lg:flex-nowrap"
        aria-labelledby="due-heading"
      >
        <h2 id="due-heading" className="font-heading text-lead text-sand-deep">
          Nothing due today
        </h2>
        <p className="text-body-sm text-sand-ink">Your next words come back soon.</p>
      </section>
    );
  }

  const preview = withDue.slice(0, 5);
  const hidden = withDue.length - preview.length;

  return (
    <section
      className="flex min-h-24 flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-2xl bg-sand-soft px-7 py-5 lg:flex-nowrap"
      aria-labelledby="due-heading"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <h2 id="due-heading" className="font-heading text-[2rem] leading-none text-sand-deep">
          {totalDue}
        </h2>
        <div className="min-w-0">
          <p className="text-body-sm font-semibold text-sand-deep">
            {totalDue === 1 ? 'word' : 'words'} due today
          </p>
          <p className="text-meta text-sand-ink">
            across {withDue.length} {withDue.length === 1 ? 'video' : 'videos'}, mixed in scheduled order
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <ul className="flex items-center -space-x-4" aria-hidden="true">
          {preview.map((video) => {
            const thumb = thumbnailFor(video);
            return (
              <li key={video.video_id}>
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-14 w-24 rounded-lg border-2 border-sand-soft object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-14 w-24 items-center justify-center rounded-lg border-2 border-sand-soft bg-[#B20710]/10 text-meta font-bold text-[#B20710]">
                    N
                  </div>
                )}
              </li>
            );
          })}
          {hidden > 0 && (
            <li className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-sand-soft bg-sand-mid text-meta font-semibold text-sand-deep">
              +{hidden}
            </li>
          )}
        </ul>

        <button
          onClick={onStartAll}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          <PlayIcon className="h-4 w-4" aria-hidden="true" />
          Start review
        </button>
      </div>
    </section>
  );
}
