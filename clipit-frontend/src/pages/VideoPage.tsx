import { useMemo, useState } from 'react';
import { AlertCircle, History as HistoryIcon, Play as PlayIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { SegmentedFilter } from '../components/SegmentedFilter';
import { VideoHistoryItem, type TrackedVideo, type Platform } from '../components/VideoHistoryItem';
import { RemoveVideoDialog } from '../components/RemoveVideoDialog';
import { Skeleton } from '../components/Skeleton';
import { LoadingAnimation } from '../components/LoadingAnimation';
import { API_BASE_URL } from '../config';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { type BackendVideo, historyQueryOptions, queryKeys } from '../lib/queries';

const EXTENSION_URL = 'https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn';

type Filter = 'all' | Platform;

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
    subtitles: hasSubs ? `${langAbbr} + EN` : null,
    newWords: 0,
    season: v.season,
    episode: v.episode,
    episodeTitle: v.episode_title,
  };
}

export function VideoPage() {
  const { language, languageName } = useLanguage();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [pendingRemoval, setPendingRemoval] = useState<TrackedVideo | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const history = useQuery({
    ...historyQueryOptions(user?.id ?? 0, token ?? '', language),
    enabled: Boolean(user && token),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const videos = useMemo(
    () => (history.data || []).map((video) => mapVideo(video, language)),
    [history.data, language],
  );
  const loadState = history.isPending ? 'loading' : history.isError ? 'error' : 'loaded';

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
        queryClient.setQueryData<BackendVideo[]>(queryKeys.history(user?.id ?? 0, language), (current = []) =>
          current.filter((video) => video.video_id !== pendingRemoval.id),
        );
        queryClient.removeQueries({ queryKey: queryKeys.homeQueue(user?.id ?? 0, language) });
        queryClient.removeQueries({ queryKey: queryKeys.watchTime(user?.id ?? 0, language) });
      }
    } finally {
      setIsRemoving(false);
      setPendingRemoval(null);
    }
  }

  return (
    <main className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8">
      <header className="grid gap-8 rounded-2xl bg-sand-soft px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-meta font-bold uppercase tracking-[0.14em] text-sand-deep">
            <HistoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Your library
          </div>
          <h1 className="font-heading text-display text-sand-deep sm:text-display-lg">Watch history</h1>
          <p className="mt-3 max-w-xl text-body text-sand-ink">
            Every {languageName} video ClipIt tracks is ready to become your next practice session.
          </p>
        </div>
        <div className="flex gap-3 text-sand-deep">
          <div className="min-w-28 rounded-xl bg-white/20 px-4 py-3">
            <p className="text-meta font-bold uppercase tracking-wide text-sand-ink">Videos</p>
            <p className="mt-1 font-heading text-card-title">{loadState === 'loading' ? '—' : videos.length}</p>
          </div>
          <div className="min-w-36 rounded-xl bg-white/20 px-4 py-3">
            <p className="text-meta font-bold uppercase tracking-wide text-sand-ink">Updates</p>
            <p className="mt-1 text-body-sm font-bold">Automatically</p>
          </div>
        </div>
      </header>

      <section className="mt-12" aria-labelledby="history-library-heading">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-meta font-bold uppercase tracking-[0.14em] text-muted">Saved by ClipIt</p>
            <h2 id="history-library-heading" className="mt-1 font-heading text-section text-primary">Your videos</h2>
          </div>
          <SegmentedFilter options={options} value={filter} onChange={setFilter} label="Filter history by platform" />
        </div>

        {loadState === 'loading' && (
          <div className="mt-6" role="status" aria-live="polite">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl bg-surface p-4">
                <Skeleton className="aspect-video w-full rounded-xl" />
                <Skeleton className="mt-5 h-5 w-4/5 rounded-md" />
                <Skeleton className="mt-2 h-4 w-2/5 rounded-md" />
                <Skeleton className="mt-6 h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-3 text-body-sm text-muted">
            <LoadingAnimation className="h-7 w-7" />
            <p>Loading your watch history…</p>
          </div>
        </div>
      )}

        {loadState === 'error' && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-error/10 text-error" aria-hidden="true">
            <AlertCircle className="h-6 w-6" />
          </span>
          <div>
            <p className="font-semibold text-primary">Backend not reachable</p>
            <p className="mt-1 text-body-sm text-secondary">Make sure the ClipIt server is running and accessible.</p>
          </div>
          <button
            type="button"
            onClick={() => void history.refetch()}
            className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      )}

        {loadState === 'loaded' && visible.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={filter === 'all' ? 'No videos yet' : `No ${filter === 'youtube' ? 'YouTube' : 'Netflix'} videos yet`}
            description={filter === 'all'
              ? 'Get the extension, turn it on, then watch YouTube or Netflix to record videos here.'
              : `Get the extension, turn it on, then watch ${filter === 'youtube' ? 'YouTube' : 'Netflix'} to record videos here.`}
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
              href={EXTENSION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
            >
              Get the ClipIt extension
            </a>
          </EmptyState>
        </div>
      )}

        {loadState === 'loaded' && visible.length > 0 && (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false}>
            {visible.map((video, index) => (
              <motion.li
                key={video.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, delay: Math.min(0.04 * index, 0.24), ease: [0.23, 1, 0.32, 1] }}
              >
                <VideoHistoryItem video={video} onRemove={setPendingRemoval} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      </section>

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
    </main>
  );
}
