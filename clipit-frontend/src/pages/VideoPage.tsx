import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Play as PlayIcon, RefreshCw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { EmptyState } from '../components/EmptyState';
import { SegmentedFilter } from '../components/SegmentedFilter';
import { VideoHistoryItem, type TrackedVideo, type Platform } from '../components/VideoHistoryItem';
import { RemoveVideoDialog } from '../components/RemoveVideoDialog';
import { API_BASE_URL } from '../config';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const EXTENSION_URL = 'https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn';

interface BackendVideo {
  video_id: string;
  title: string;
  tracked_at: number;
  has_korean: number | null;
  has_ukrainian: number | null;
  has_english: number | null;
  season?: number | null;
  episode?: number | null;
  episode_title?: string | null;
}

type Filter = 'all' | Platform;
type LoadState = 'loading' | 'loaded' | 'error';

function formatTrackedAt(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

function mapVideo(v: BackendVideo, language: 'ko' | 'uk' | 'en'): TrackedVideo {
  const isNetflix = v.video_id.startsWith('netflix_');
  const hasSubs = language === 'uk' ? v.has_ukrainian : language === 'en' ? v.has_english : v.has_korean;
  const langAbbr = language === 'uk' ? 'UK' : language === 'en' ? 'EN' : 'KO';
  return {
    id: v.video_id,
    platform: isNetflix ? 'netflix' : 'youtube',
    title: v.title,
    thumbnail: isNetflix
      ? `${API_BASE_URL}/netflix/thumbnail/${v.video_id}`
      : `https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`,
    trackedAt: formatTrackedAt(v.tracked_at),
    subtitles: hasSubs === 1 ? `${langAbbr} + EN` : null,
    newWords: 0,
    season: v.season,
    episode: v.episode,
    episodeTitle: v.episode_title,
  };
}

export function VideoPage() {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState<Filter>('all');
  const [pendingRemoval, setPendingRemoval] = useState<TrackedVideo | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  async function fetchVideos(silent = false) {
    try {
      const res = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      const vids: BackendVideo[] = data.videos || [];
      setVideos(vids.map((v) => mapVideo(v, language)));
      setLoadState('loaded');
    } catch {
      // On a background poll, keep showing the current list instead of
      // flipping to the error screen on a transient blip.
      if (!silent) setLoadState('error');
    }
  }

  useEffect(() => {
    setLoadState('loading');
    fetchVideos();
  }, [language, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silently re-fetch every 10s (only when the tab is visible) so newly
  // captured videos appear without a manual refresh.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchVideos(true);
    }, 10000);
    return () => clearInterval(id);
  }, [language, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(
    () => [
      { id: 'all' as Filter, label: 'All', count: videos.length },
      { id: 'youtube' as Filter, label: 'YouTube', count: videos.filter((v) => v.platform === 'youtube').length },
      { id: 'netflix' as Filter, label: 'Netflix', count: videos.filter((v) => v.platform === 'netflix').length },
    ],
    [videos],
  );
  const visible = filter === 'all' ? videos : videos.filter((video) => video.platform === filter);

  async function handleRemove(alsoFlashcards: boolean) {
    if (!pendingRemoval) return;
    setIsRemoving(true);
    try {
      const params = new URLSearchParams();
      if (alsoFlashcards) {
        params.set('delete_flashcards', 'true');
        params.set('lang', language);
      }
      const url = `${API_BASE_URL}/videos/${encodeURIComponent(pendingRemoval.id)}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setVideos((current) => current.filter((video) => video.id !== pendingRemoval.id));
      }
    } finally {
      setIsRemoving(false);
      setPendingRemoval(null);
    }
  }

  return (
    <div className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8">
      <header className="flex items-start justify-between gap-4 pb-6">
        <div>
          <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">Watch history</h1>
          <p className="mt-1 text-body text-secondary">{languageName} videos the ClipIt extension tracked for you.</p>
        </div>
        <button
          type="button"
          onClick={() => fetchVideos()}
          className="mt-1 flex shrink-0 items-center gap-2 rounded-xl border border-subtle px-4 py-2 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </header>

      <SegmentedFilter options={options} value={filter} onChange={setFilter} label="Filter history by platform" />

      {loadState === 'loading' && (
        <div className="mt-6 space-y-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4 sm:flex-row animate-pulse">
              <div className="aspect-video w-full shrink-0 rounded-lg bg-blush sm:w-52" />
              <div className="flex flex-1 flex-col justify-center gap-3 py-1">
                <div className="h-5 w-3/4 rounded-md bg-blush" />
                <div className="h-4 w-1/3 rounded-md bg-blush" />
              </div>
            </div>
          ))}
        </div>
      )}

      {loadState === 'error' && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-subtle bg-surface px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-error/10 text-error" aria-hidden="true">
            <AlertCircle className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-primary">Backend not reachable</p>
            <p className="mt-1 text-body-sm text-secondary">Make sure the ClipIt server is running and accessible.</p>
          </div>
          <button
            type="button"
            onClick={() => { setLoadState('loading'); fetchVideos(); }}
            className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === 'loaded' && visible.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={filter === 'all' ? 'Nothing tracked yet' : `No ${filter === 'youtube' ? 'YouTube' : 'Netflix'} videos yet`}
            visual={
              <div className="mx-auto grid max-w-md grid-cols-3 gap-3" aria-hidden="true">
                {[0, 1, 2].map((tile) => (
                  <div key={tile} className="space-y-2" style={{ opacity: 1 - tile * 0.25 }}>
                    <div className="flex aspect-video items-center justify-center rounded-lg bg-blush">
                      <PlayIcon className="h-5 w-5 text-accent/50" />
                    </div>
                    <div className="h-2.5 w-3/4 rounded-md bg-blush" />
                  </div>
                ))}
              </div>
            }
          >
            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
            >
              Browse YouTube
            </a>
            <a
              href="https://www.netflix.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-subtle px-5 py-2.5 text-body-sm font-semibold text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
            >
              Browse Netflix
            </a>
            <a
              href={EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-sm text-muted underline decoration-transparent underline-offset-2 transition-colors duration-150 ease-swift hover:text-accent hover:decoration-accent/40"
            >
              Need the extension?
            </a>
          </EmptyState>
        </div>
      )}

      {loadState === 'loaded' && visible.length > 0 && (
        <ul className="mt-6 space-y-4">
          <AnimatePresence initial={false}>
            {visible.map((video, index) => (
              <motion.li
                key={video.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, delay: 0.04 * index, ease: [0.23, 1, 0.32, 1] }}
              >
                <VideoHistoryItem video={video} onRemove={setPendingRemoval} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AnimatePresence>
        {pendingRemoval && (
          <RemoveVideoDialog
            video={pendingRemoval}
            isRemoving={isRemoving}
            onCancel={() => !isRemoving && setPendingRemoval(null)}
            onRemove={handleRemove}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
