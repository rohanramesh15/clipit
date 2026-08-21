import { useState } from 'react';
import { ExternalLink, Trash2, Play } from 'lucide-react';

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
    <article className="group flex items-center gap-5 border-b border-subtle py-4">
      <a
        href={watchUrl(video)}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-hover"
      >
        <Thumbnail video={video} />
        {video.platform === 'netflix' && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-[#b20710] px-1.5 py-0.5 text-meta font-semibold text-white">
            {PLATFORM_LABEL[video.platform]}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-inverse/40 opacity-0 transition-opacity duration-150 ease-swift group-hover:opacity-100">
          <Play className="h-4 w-4 text-cream" aria-hidden="true" />
        </span>
      </a>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body font-semibold text-primary">{video.title}</h3>
        {episode ? <p className="mt-0.5 truncate text-body-sm text-muted">{episode}</p> : <p className="mt-0.5 truncate text-body-sm text-muted">{PLATFORM_LABEL[video.platform]} · {video.trackedAt}{video.subtitles ? ' · Subtitles tracked' : ''}</p>}
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
    </article>
  );
}
