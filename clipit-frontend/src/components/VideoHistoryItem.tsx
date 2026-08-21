import React, { useState } from 'react';
import { ExternalLink, Trash2, BookOpen, Play } from 'lucide-react';

export type Platform = 'youtube' | 'netflix';

export interface TrackedVideo {
  id: string;
  platform: Platform;
  title: string;
  thumbnail: string;
  /** Relative label, e.g. "2h ago". */
  trackedAt: string;
  /** Subtitle track pair, e.g. "KO + EN". Null when no subtitles were found. */
  subtitles: string | null;
  newWords: number;
  season?: number | null;
  episode?: number | null;
  episodeTitle?: string | null;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: 'YouTube',
  netflix: 'Netflix',
};

function watchUrl(video: TrackedVideo): string {
  return video.platform === 'youtube'
    ? `https://www.youtube.com/watch?v=${video.id}`
    : `https://www.netflix.com/watch/${video.id.replace('netflix_', '')}`;
}

function episodeLine(video: TrackedVideo): string | null {
  if (!video.season && !video.episode) return null;
  const parts = [video.season ? `Season ${video.season}` : null, video.episode ? `Episode ${video.episode}` : null].filter(
    Boolean,
  );
  return video.episodeTitle ? `${parts.join(', ')} — ${video.episodeTitle}` : parts.join(', ');
}

function Thumbnail({ video }: { video: TrackedVideo }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#B20710]/10">
        <span className="text-xl font-bold text-[#B20710]">N</span>
      </div>
    );
  }

  return (
    <img
      src={video.thumbnail}
      alt={`Thumbnail for ${video.title}`}
      className="aspect-video w-full object-cover"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

interface VideoHistoryItemProps {
  video: TrackedVideo;
  onRemove: (video: TrackedVideo) => void;
}

export function VideoHistoryItem({ video, onRemove }: VideoHistoryItemProps) {
  const episode = episodeLine(video);
  return (
    <article className="group flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4 sm:flex-row">
      <a
        href={watchUrl(video)}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block w-full shrink-0 overflow-hidden rounded-lg sm:w-52"
      >
        <Thumbnail video={video} />
        <span
          className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-meta font-semibold text-white ${
            video.platform === 'netflix' ? 'bg-[#b20710]' : 'bg-[#ff0000]'
          }`}
        >
          {PLATFORM_LABEL[video.platform]}
        </span>
        {video.subtitles && (
          <span className="absolute right-2 top-2 rounded-md bg-inverse/80 px-2 py-0.5 text-meta font-semibold text-cream">
            {video.subtitles}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-inverse/40 opacity-0 transition-opacity duration-150 ease-swift group-hover:opacity-100">
          <Play className="h-8 w-8 text-cream" aria-hidden="true" />
        </span>
      </a>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-lead font-semibold text-primary">{video.title}</h3>
            {episode && <p className="mt-1 truncate text-body-sm text-secondary">{episode}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 ease-swift focus-within:opacity-100 group-hover:opacity-100">
            <a
              href={watchUrl(video)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open on ${PLATFORM_LABEL[video.platform]}`}
              className="rounded-lg p-2 text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Open on {PLATFORM_LABEL[video.platform]}</span>
            </a>
            <button
              type="button"
              onClick={() => onRemove(video)}
              title="Remove from history"
              className="rounded-lg p-2 text-secondary transition-colors duration-150 ease-swift hover:bg-blush hover:text-accent"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Remove {video.title} from history</span>
            </button>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-body-sm">
          <span className="text-muted">{video.trackedAt}</span>
          {video.subtitles ? (
            <span className="flex items-center gap-1.5 text-secondary">
              <BookOpen className="h-4 w-4 text-muted" aria-hidden="true" />
              Subtitles tracked
            </span>
          ) : (
            <span className="text-muted">No subtitles found</span>
          )}
          {video.newWords > 0 && (
            <span className="rounded-md bg-sand-soft px-2 py-0.5 text-meta font-semibold text-sand-ink">
              {video.newWords} new words
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
