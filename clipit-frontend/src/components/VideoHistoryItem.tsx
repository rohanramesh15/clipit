import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Trash2, Play, ChevronUp } from 'lucide-react';
import { Button } from './ui/button';
import { API_BASE_URL } from '../config';

export interface SubtitleWord {
  word: string;
  english: string | null;
}

export type Platform = 'youtube' | 'netflix';

export interface TrackedVideo {
  id: string;
  platform: Platform;
  title: string;
  thumbnail: string;
  /** Relative label, e.g. "2h ago". */
  trackedAt: string;
  subtitleStatus: 'tracked' | 'processing' | 'checking' | 'not-tracked';
  newWords: number;
  season?: number | null;
  episode?: number | null;
  episodeTitle?: string | null;
  transcriptProgress?: TranscriptProgress;
}

interface TranscriptProgress {
  status: 'receiving' | 'processing' | 'complete' | 'failed';
  receivedBatches: number;
  processedBatches: number;
  totalBatches: number;
  words: { word: string; rank?: number; language?: string }[];
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
  loadWordCount: (video: TrackedVideo) => Promise<number>;
  loadSubtitleWords: (video: TrackedVideo) => Promise<SubtitleWord[]>;
  token: string | null;
  language: 'ko' | 'uk' | 'en';
  onTranscriptComplete: () => void;
}

export function VideoHistoryItem({ video, onRemove, loadWordCount, loadSubtitleWords, token, language, onTranscriptComplete }: VideoHistoryItemProps) {
  const episode = episodeLine(video);
  const [isWordsOpen, setIsWordsOpen] = useState(false);
  const [words, setWords] = useState<SubtitleWord[] | null>(null);
  const [wordsError, setWordsError] = useState(false);
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [wordCountError, setWordCountError] = useState(false);
  const [progress, setProgress] = useState<TranscriptProgress | undefined>(video.transcriptProgress);
  const isProcessing = video.subtitleStatus === 'processing';
  const isTracked = video.subtitleStatus === 'tracked';
  const wordsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProgress(video.transcriptProgress);
  }, [video.transcriptProgress]);

  useEffect(() => {
    if (!isTracked) return;
    let cancelled = false;
    setWordCount(null);
    setWordCountError(false);
    loadWordCount(video)
      .then((count) => { if (!cancelled) setWordCount(count); })
      .catch(() => { if (!cancelled) setWordCountError(true); });
    return () => { cancelled = true; };
    // Re-fetch only when the underlying video or its tracked status changes,
    // not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, isTracked]);

  useEffect(() => {
    if (!isWordsOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (wordsMenuRef.current && !wordsMenuRef.current.contains(event.target as Node)) {
        setIsWordsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsWordsOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isWordsOpen]);

  useEffect(() => {
    if (!isProcessing || !token || language === 'en') return;
    const controller = new AbortController();

    async function streamProgress() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/youtube/subtitles/${encodeURIComponent(video.id)}/progress?lang=${encodeURIComponent(language)}`,
          { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
        );
        if (!response.ok || !response.body) return;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let separator = buffer.indexOf('\n\n');
          while (separator >= 0) {
            const frame = buffer.slice(0, separator);
            buffer = buffer.slice(separator + 2);
            separator = buffer.indexOf('\n\n');
            const event = frame.match(/^event: (.+)$/m)?.[1];
            const data = frame.match(/^data: (.+)$/m)?.[1];
            if (!data || event === 'error' || event === 'timeout') continue;
            const next = JSON.parse(data) as {
              status: TranscriptProgress['status'];
              received_batches: number;
              processed_batches: number;
              total_batches: number;
              words: TranscriptProgress['words'];
            };
            setProgress({
              status: next.status,
              receivedBatches: next.received_batches,
              processedBatches: next.processed_batches,
              totalBatches: next.total_batches,
              words: next.words || [],
            });
            if (event === 'complete') onTranscriptComplete();
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // History polling still supplies the durable job state after a transient stream failure.
        }
      }
    }

    void streamProgress();
    return () => controller.abort();
  }, [isProcessing, language, onTranscriptComplete, token, video.id]);

  const subtitleLabel = video.subtitleStatus === 'processing'
    ? `Processing transcript · ${progress?.processedBatches ?? 0}/${progress?.totalBatches ?? 0} batches`
    : video.subtitleStatus === 'checking'
      ? 'Checking subtitles'
      : 'Captions not captured';
  const subtitleClass = video.subtitleStatus === 'not-tracked' ? 'text-error' : 'text-muted';

  async function toggleWords() {
    if (isWordsOpen) {
      setIsWordsOpen(false);
      return;
    }
    setIsWordsOpen(true);
    if (words) return;
    try {
      setWordsError(false);
      setWords(await loadSubtitleWords(video));
    } catch {
      setWordsError(true);
    }
  }

  return (
    <article className="group border-b border-subtle py-4">
      <div className="flex items-center gap-5">
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
        {episode && <p className="mt-0.5 truncate text-body-sm text-muted">{episode}</p>}
        <div className="relative" ref={wordsMenuRef}>
        <p className="mt-0.5 truncate text-body-sm text-muted">
          {PLATFORM_LABEL[video.platform]}
          <span className="mx-2" aria-hidden="true">·</span>
          {video.trackedAt}
          <span className="mx-2" aria-hidden="true">·</span>
          {isTracked ? (
            wordCountError ? (
              <span className="text-muted">Words tracked</span>
            ) : wordCount === null ? (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />
                <span>Counting words…</span>
              </span>
            ) : wordCount === 0 ? (
              <span className="text-muted">No words tracked yet</span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <span className="text-primary">{wordCount} word{wordCount === 1 ? '' : 's'} tracked</span>
                <button
                  type="button"
                  onClick={toggleWords}
                  aria-expanded={isWordsOpen}
                  aria-label={isWordsOpen ? 'Hide tracked words' : 'Show tracked words'}
                  className="rounded p-0.5 text-accent transition-colors hover:text-accent-hover"
                >
                  <ChevronUp
                    className={`h-3.5 w-3.5 transition-transform duration-150 ease-swift ${isWordsOpen ? '' : 'rotate-180'}`}
                    aria-hidden="true"
                  />
                </button>
              </span>
            )
          ) : <span className={subtitleClass}>{subtitleLabel}</span>}
        </p>
        {isWordsOpen && (
          <div className="absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-subtle bg-surface px-4 py-3 shadow-pop">
            {wordsError ? (
              <p className="text-body-sm text-error">Couldn’t load subtitle words. Try again.</p>
            ) : words === null ? (
              <p className="text-body-sm text-secondary">Loading subtitle words…</p>
            ) : words.length ? (
              <ul className="flex max-h-56 flex-col divide-y divide-subtle overflow-y-auto pr-1" aria-label={`Words tracked from ${video.title}`}>
                {words.map((item) => (
                  <li key={item.word} className="flex items-baseline justify-between gap-4 py-1.5 text-body-sm">
                    <span className="font-medium text-primary">{item.word}</span>
                    <span className="truncate text-secondary">{item.english || '—'}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body-sm text-secondary">No subtitle words found for this video.</p>
            )}
          </div>
        )}
        </div>
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
            <Button
              type="button"
              onClick={() => onRemove(video)}
              title="Remove from history"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${video.title} from history`}
              className="h-8 w-8 hover:bg-accent-soft hover:text-accent"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
      </div>
      </div>
      {isProcessing && (
        <div className="ml-[7.25rem] mt-3 rounded-xl border border-subtle bg-app px-4 py-3 sm:ml-[8.5rem]" aria-live="polite">
          <p className="text-body-sm font-medium text-primary">Words found so far</p>
          <p className="mt-0.5 text-body-sm text-secondary">
            {progress?.receivedBatches ?? 0} of {progress?.totalBatches ?? 0} transcript batches received; more words will appear as processing finishes.
          </p>
          {progress?.words?.length ? (
            <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1">
              {progress.words.map((item) => <span key={item.word} className="rounded-md bg-surface px-2 py-1 text-body-sm text-primary">{item.word}</span>)}
            </div>
          ) : <p className="mt-3 text-body-sm text-muted">Finding vocabulary in the first batch…</p>}
        </div>
      )}
    </article>
  );
}
