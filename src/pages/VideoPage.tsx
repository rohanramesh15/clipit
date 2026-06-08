import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Clock,
  BookOpen,
  Youtube,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Tv,
  Film,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { Skeleton } from '../components/Skeleton';
import { SegmentedTabs } from '../components/SegmentedTabs';

const videoPageTips: HelpTip[] = [
  {
    id: 'platform-filter',
    text: 'Filter by YouTube or Netflix to find specific videos.',
    targetId: 'section-platform-tabs',
    position: 'right',
  },
  {
    id: 'video-grid',
    text: 'Videos you watch with the browser extension appear here. Click to watch again, hover to delete.',
    targetId: 'section-video-grid',
    position: 'top',
  },
];

function NetflixThumbnail({ videoId }: { videoId: string }) {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#B20710]/10">
        <span className="text-[#B20710] font-bold text-xl">N</span>
      </div>
    );
  }

  return (
    <img
      src={`${API_BASE_URL}/netflix/thumbnail/${videoId}`}
      alt=""
      className="w-full h-full object-cover"
      onError={() => setHasError(true)}
    />
  );
}

interface TrackedVideo {
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

type LoadState = 'loading' | 'loaded' | 'error' | 'empty';
type PlatformFilter = 'all' | 'youtube'

| 'netflix';

function formatTrackedAt(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

export function VideoPage() {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();
  const [videos, setVideos] = useState<TrackedVideo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ video: TrackedVideo } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter videos by platform
  const filteredVideos = useMemo(() => {
    if (platformFilter === 'all') return videos;
    if (platformFilter === 'netflix') return videos.filter(v => v.video_id.startsWith('netflix_'));
    return videos.filter(v => !v.video_id.startsWith('netflix_'));
  }, [videos, platformFilter]);

  // Count videos by platform
  const counts = useMemo(() => ({
    all: videos.length,
    youtube: videos.filter(v => !v.video_id.startsWith('netflix_')).length,
    netflix: videos.filter(v => v.video_id.startsWith('netflix_')).length,
  }), [videos]);

  async function fetchVideos(silent: boolean = false) {
    try {
      const res = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      const vids: TrackedVideo[] = data.videos || [];
      setVideos(vids);
      setLoadState(vids.length ? 'loaded' : 'empty');
    } catch {
      // On a background poll, keep showing the current list instead of flipping
      // to the error screen on a transient blip.
      if (!silent) setLoadState('error');
    }
  }

  useEffect(() => {
    fetchVideos();
  }, [language, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh: silently re-fetch every 10s (only when the tab is visible) so
  // newly captured videos appear without clicking Refresh.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchVideos(true);
    }, 10000);
    return () => clearInterval(id);
  }, [language, token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchVideos();
    setIsRefreshing(false);
  }

  async function handleDeleteVideo(videoId: string, deleteFlashcards: boolean = false) {
    setIsDeleting(true);
    try {
      const params = new URLSearchParams();
      if (deleteFlashcards) {
        params.set('delete_flashcards', 'true');
        params.set('lang', language);
      }
      const url = `${API_BASE_URL}/videos/${encodeURIComponent(videoId)}${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.video_id !== videoId));
      }
    } catch (error) {
      console.error('Failed to delete video:', error);
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(null);
    }
  }

  return (
    <div className="pb-8 max-w-6xl mx-auto px-4 pt-8">
      <HelpOverlay tips={videoPageTips} />

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary mb-2">
            Watch History
          </h1>
          <p className="text-secondary max-w-2xl">
            {languageName} videos tracked by extension.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-white/5 hover:border-white/10 text-secondary hover:text-primary transition-all text-sm font-medium mt-1">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Platform Tabs */}
      <div id="section-platform-tabs" className="mb-6">
        <SegmentedTabs
          layoutId="history-tab-pill"
          active={platformFilter}
          onChange={setPlatformFilter}
          tabs={[
            { id: 'all', label: 'All', Icon: Tv, count: counts.all },
            { id: 'youtube', label: 'YouTube', Icon: Youtube, count: counts.youtube },
            { id: 'netflix', label: 'Netflix', Icon: Film, count: counts.netflix },
          ]}
        />
      </div>

      {/* States */}
      <AnimatePresence mode="wait">
        {loadState === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-surface border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row gap-4">
                <Skeleton className="w-full sm:w-48 aspect-video rounded-lg shrink-0" />
                <div className="flex-1 py-1 flex flex-col justify-center gap-3">
                  <Skeleton className="h-5 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {loadState === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-primary font-semibold">Backend not reachable</p>
            <p className="text-secondary text-sm">Make sure the ClipIt server is running and accessible.</p>
            <button
              onClick={handleRefresh}
              className="mt-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-semibold hover:bg-accent/20 transition-colors">
              Try again
            </button>
          </motion.div>
        )}

        {loadState === 'empty' && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-6">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
              <Tv className="w-8 h-8 text-accent" />
            </div>
            <div className="text-center">
              <p className="text-primary font-semibold text-lg mb-2">No videos tracked yet</p>
              <p className="text-secondary text-sm max-w-sm">
                Watch any {languageName} video on YouTube or Netflix — the Clip It extension will track it automatically.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-app font-semibold transition-all shadow-lg shadow-accent/20">
                <Youtube className="w-5 h-5" />
                Browse YouTube
                <ExternalLink className="w-4 h-4 opacity-70" />
              </a>
              <a
                href="https://www.netflix.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-app font-semibold transition-all shadow-lg shadow-accent/20">
                <Film className="w-5 h-5" />
                Browse Netflix
                <ExternalLink className="w-4 h-4 opacity-70" />
              </a>
            </div>
            <p className="text-muted text-xs mt-2">
              Make sure the <a href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Clip It browser extension</a> is installed and enabled
            </p>
          </motion.div>
        )}

        {loadState === 'loaded' && (
          <motion.div
            id="section-video-grid"
            key="loaded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3">
            {filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                  {platformFilter === 'netflix' ? (
                    <Film className="w-7 h-7 text-muted" />
                  ) : (
                    <Youtube className="w-7 h-7 text-muted" />
                  )}
                </div>
                <p className="text-secondary text-sm">
                  No {platformFilter === 'netflix' ? 'Netflix' : 'YouTube'} videos tracked yet
                </p>
              </div>
            ) : (
              filteredVideos.map((video, index) => {
                const isNetflix = video.video_id.startsWith('netflix_');
                const netflixId = isNetflix ? video.video_id.replace('netflix_', '') : null;
                const videoUrl = isNetflix
                  ? `https://www.netflix.com/watch/${netflixId}`
                  : `https://www.youtube.com/watch?v=${video.video_id}`;

                return (
                  <motion.div
                    key={video.video_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="group bg-surface border border-white/5 rounded-xl p-3 hover:bg-surface-hover hover:border-white/10 transition-all cursor-default flex flex-col sm:flex-row gap-4">

                    {/* Thumbnail */}
                    <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden shrink-0 bg-white/5">
                      {isNetflix ? (
                        <NetflixThumbnail videoId={video.video_id} />
                      ) : (
                        <img
                          src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = '0';
                          }}
                        />
                      )}
                      {/* Platform badge */}
                      <div className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 ${
                        isNetflix ? 'bg-[#B20710]' : 'bg-[#FF0000]'
                      }`}>
                        {isNetflix ? (
                          <>
                            <Film className="w-3 h-3" />
                            Netflix
                          </>
                        ) : (
                          <>
                            <Youtube className="w-3 h-3" />
                            YouTube
                          </>
                        )}
                      </div>
                      {/* Language badge */}
                      {(language === 'uk' ? video.has_ukrainian : language === 'en' ? video.has_english : video.has_korean) === 1 && (
                        <div className="absolute top-2 right-2 bg-accent/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-app">
                          {language === 'uk' ? 'UK' : language === 'en' ? 'EN' : 'KO'} + EN
                        </div>
                      )}
                      {/* Hover play link */}
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30"
                        onClick={e => e.stopPropagation()}>
                        <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
                          <Play className="w-3 h-3 text-white fill-current ml-0.5" />
                        </div>
                      </a>
                    </div>

                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-center py-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <div>
                          <h3 className="font-bold text-primary group-hover:text-accent transition-colors line-clamp-2">
                            {video.title}
                          </h3>
                          {/* Episode info for Netflix shows */}
                          {isNetflix && (video.season || video.episode) && (
                            <p className="text-sm text-secondary mt-0.5">
                              {video.season && video.episode
                                ? `Season ${video.season}, Episode ${video.episode}`
                                : video.season
                                  ? `Season ${video.season}`
                                  : `Episode ${video.episode}`}
                              {video.episode_title && (
                                <span className="text-muted"> — {video.episode_title}</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ video });
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors"
                            title="Remove from history">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <a
                            href={videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink className="w-4 h-4 text-muted hover:text-accent transition-colors" />
                          </a>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-auto">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTrackedAt(video.tracked_at)}
                        </div>
                        {(language === 'uk' ? video.has_ukrainian : language === 'en' ? video.has_english : video.has_korean) === 1 && (
                          <div className="flex items-center gap-1.5 text-xs text-accent/80 bg-accent/5 px-2 py-0.5 rounded border border-accent/10">
                            <BookOpen className="w-3 h-3" />
                            {languageName} subtitles
                          </div>
                        )}
                        {(language === 'uk' ? video.has_ukrainian : language === 'en' ? video.has_english : video.has_korean) === 0 && (
                          <div className="text-xs text-muted/60 bg-white/3 px-2 py-0.5 rounded border border-white/5">
                            No {languageName} subs
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isDeleting && setDeleteConfirm(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-primary transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">
                Remove from History?
              </h3>
              <p className="text-secondary text-sm mb-1">
                <span className="font-medium text-primary">{deleteConfirm.video.title}</span>
              </p>
              <p className="text-muted text-sm mb-6">
                Choose whether to also delete flashcards for words found in this video.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDeleteVideo(deleteConfirm.video.video_id, false)}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 transition-colors font-medium text-sm flex items-center justify-center gap-2">
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Remove Video Only
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteVideo(deleteConfirm.video.video_id, true)}
                  disabled={isDeleting}
                  className="w-full px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm flex items-center justify-center gap-2">
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Removing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Remove Video & Flashcards
                    </>
                  )}
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={isDeleting}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary hover:text-primary hover:bg-white/10 transition-colors font-medium text-sm">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
