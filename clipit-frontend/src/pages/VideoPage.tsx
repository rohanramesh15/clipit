import { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EmptyState } from '../components/EmptyState';
import { SegmentedFilter } from '../components/SegmentedFilter';
import { VideoHistoryItem, type TrackedVideo, type Platform } from '../components/VideoHistoryItem';
import { RemoveVideoDialog } from '../components/RemoveVideoDialog';
import { Skeleton } from '../components/Skeleton';
import { API_BASE_URL } from '../config';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { type BackendVideo, queryKeys, watchHistoryQueryOptions } from '../lib/queries';
import { Button } from '../components/ui/button';
import { useExtensionInstall } from '../components/ExtensionInstallModal';

type Filter = 'all' | Platform;

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function formatTrackedAt(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  if (diff < 4 * WEEK) return `${Math.max(1, Math.floor(diff / WEEK))}w ago`;
  if (diff < YEAR) return `${Math.max(1, Math.floor(diff / MONTH))}mo ago`;
  return `${Math.max(1, Math.floor(diff / YEAR))}y ago`;
}

function mapVideo(v: BackendVideo, language: 'ko' | 'uk' | 'en'): TrackedVideo {
  const isNetflix = v.video_id.startsWith('netflix_');
  const hasSubs = language === 'uk' ? v.has_ukrainian : language === 'en' ? v.has_english : v.has_korean;
  const subtitleStatus = v.transcript_status === 'receiving' || v.transcript_status === 'processing'
    ? 'processing'
    : hasSubs === true || hasSubs === 1 ? 'tracked' : 'not-tracked';
  return {
    id: v.video_id,
    platform: isNetflix ? 'netflix' : 'youtube',
    title: v.title,
    thumbnail: v.thumbnail_url || (isNetflix
      ? `${API_BASE_URL}/netflix/thumbnail/${v.video_id}`
      : `https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`),
    trackedAt: formatTrackedAt(v.tracked_at),
    subtitleStatus,
    newWords: 0,
    season: v.season,
    episode: v.episode,
    episodeTitle: v.episode_title,
    transcriptProgress: v.transcript_status ? {
      status: v.transcript_status,
      receivedBatches: v.transcript_received_batches ?? 0,
      processedBatches: v.transcript_processed_batches ?? 0,
      totalBatches: v.transcript_total_batches ?? 0,
      words: v.transcript_words ?? [],
    } : undefined,
  };
}

export function VideoPage() {
  const { language, languageName } = useLanguage();
  const { openExtensionInstall } = useExtensionInstall();
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [pendingRemoval, setPendingRemoval] = useState<TrackedVideo | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const history = useQuery({
    ...watchHistoryQueryOptions(user?.id ?? 0, token ?? '', language),
    enabled: Boolean(user && token),
    // Extension writes happen outside the web app's query cache. Keep this
    // lightweight list in sync while it is visible, and always verify it when
    // the learner opens or returns to Watch History.
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
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

  async function loadSubtitleWords(video: TrackedVideo): Promise<string[]> {
    if (!token) throw new Error('Not authenticated');
    const response = await fetch(
      `${API_BASE_URL}/vocabulary/${encodeURIComponent(video.id)}?lang=${encodeURIComponent(language)}&include_all=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error('Could not load subtitle words');
    const data = await response.json() as { vocabulary?: { word?: string }[] };
    return [...new Set((data.vocabulary || []).map((item) => item.word?.trim()).filter((word): word is string => Boolean(word)))];
  }

  async function handleRemove() {
    if (!pendingRemoval) return;
    setIsRemoving(true);
    try {
      const params = new URLSearchParams();
      params.set('delete_flashcards', 'true');
      params.set('lang', language);
      const url = `${API_BASE_URL}/videos/${encodeURIComponent(pendingRemoval.id)}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        queryClient.setQueryData<BackendVideo[]>(queryKeys.watchHistory(user?.id ?? 0, language), (current = []) =>
          current.filter((video) => video.video_id !== pendingRemoval.id),
        );
        queryClient.removeQueries({ queryKey: queryKeys.homeQueue(user?.id ?? 0, language) });
        queryClient.removeQueries({ queryKey: queryKeys.watchTime(user?.id ?? 0, language) });
        queryClient.removeQueries({
          queryKey: queryKeys.progressSummary(user?.id ?? 0, language, new Date().getFullYear()),
        });
        queryClient.removeQueries({ queryKey: queryKeys.videoVocabulary(user?.id ?? 0, language, pendingRemoval.id) });
        queryClient.removeQueries({ queryKey: queryKeys.flashcardDeck(user?.id ?? 0, language, pendingRemoval.id) });
        queryClient.removeQueries({ queryKey: queryKeys.madlibDeck(user?.id ?? 0, language, pendingRemoval.id) });
      }
    } finally {
      setIsRemoving(false);
      setPendingRemoval(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-8">
        <div>
          <h1 className="font-heading text-section font-medium text-primary">Watch history</h1>
          <p className="mt-1 text-body text-secondary">{languageName} videos the ClipIt extension tracked for you.</p>
        </div>
        <SegmentedFilter options={options} value={filter} onChange={setFilter} label="Filter history by platform" />
      </header>

      <section aria-label="Video history">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={loadState === 'loaded' ? filter : loadState}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {loadState === 'loading' && (
            <div className="mt-6" role="status" aria-live="polite" aria-label="Loading your watch history">
              <Skeleton className="h-72 w-full rounded-2xl" />
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
              <Button
                type="button"
                onClick={() => void history.refetch()}
              >
                Try again
              </Button>
            </div>
          )}

          {loadState === 'loaded' && visible.length === 0 && (
            <div className="mt-6">
              <EmptyState
                title={filter === 'all' ? 'No videos yet' : `No ${filter === 'youtube' ? 'YouTube' : 'Netflix'} videos yet`}
                description={filter === 'all'
                  ? 'Get the extension, turn it on, then watch YouTube or Netflix to record videos here.'
                  : `Get the extension, turn it on, then watch ${filter === 'youtube' ? 'YouTube' : 'Netflix'} to record videos here.`}
              >
                <button
                  type="button"
                  onClick={openExtensionInstall}
                  className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
                >
                  Get the ClipIt extension
                </button>
              </EmptyState>
            </div>
          )}

          {loadState === 'loaded' && visible.length > 0 && (
            <ul>
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
                    <VideoHistoryItem
                      video={video}
                      onRemove={setPendingRemoval}
                      loadSubtitleWords={loadSubtitleWords}
                      token={token}
                      language={language}
                      onTranscriptComplete={() => void history.refetch()}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </motion.div>
      </AnimatePresence>

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
