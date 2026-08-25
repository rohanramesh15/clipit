import React from 'react';
import { PlayIcon } from 'lucide-react';
import { TrackedVideo } from '../../types/flashcards';
import { Skeleton } from '../Skeleton';
import { Button } from '../ui/button';

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
        <h2 id="due-heading" className="font-heading text-lead text-primary">
          Nothing due today
        </h2>
        <p className="text-body-sm text-secondary">Your next words come back soon.</p>
      </section>
    );
  }

  const preview = withDue.slice(0, 5);
  const hidden = withDue.length - preview.length;

  return (
    <section className="mt-8" aria-labelledby="continue-practicing-heading">
      <h2 id="continue-practicing-heading" className="font-sans text-body-sm font-bold tracking-[0.08em] text-secondary">Continue practicing</h2>
      <div
        className="mt-2 flex min-h-24 flex-wrap items-center justify-between gap-x-10 gap-y-5 rounded-2xl bg-sand-soft px-7 py-5 lg:flex-nowrap"
        aria-labelledby="due-heading"
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <h3 id="due-heading" className="font-heading text-section leading-none text-primary">
            {totalDue}
          </h3>
          <div className="min-w-0">
            <p className="text-body font-semibold text-primary">
              {totalDue === 1 ? 'word' : 'words'} due today
            </p>
            <p className="text-body-sm text-secondary">
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

          <Button
            onClick={onStartAll}
            className="shrink-0"
          >
            <PlayIcon className="h-4 w-4" aria-hidden="true" />
            Start review
          </Button>
        </div>
      </div>
    </section>
  );
}
