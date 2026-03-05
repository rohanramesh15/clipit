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
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config';

interface TrackedVideo {
  video_id: string;
  title: string;
  tracked_at: number;
  has_korean: number | null;
  has_ukrainian: number | null;
  season?: number | null;
  episode?: number | null;
  episode_title?: string | null;
}

type LoadState = 'loading' | 'loaded' | 'error' | 'empty';
type PlatformFilter = 'all' | 'youtube' | 'netflix';

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

  async function fetchVideos() {
    try {
      const res = await fetch(`${API_BASE}/videos/history/filtered`);
      if (!res.ok) throw new Error('Backend error');
      const data = await res.json();
      const vids: TrackedVideo[] = data.videos || [];
      setVideos(vids);
      setLoadState(vids.length ? 'loaded' : 'empty');
    } catch {
      setLoadState('error');
    }
  }

  useEffect(() => {
    fetchVideos();
  }, [language]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await fetchVideos();
    setIsRefreshing(false);
  }

  return (
    <div className="min-h-screen pb-20 max-w-6xl mx-auto px-4 pt-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold text-primary mb-2">
            Watch History
          </h1>
          <p className="text-secondary max-w-2xl">
            {languageName} videos tracked by the Deadbird extension — vocabulary extracted automatically.
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
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setPlatformFilter('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            platformFilter === 'all'
              ? 'bg-accent text-app'
              : 'bg-surface border border-white/5 text-secondary hover:text-primary hover:border-white/10'
          }`}>
          <Tv className="w-4 h-4" />
          All
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            platformFilter === 'all' ? 'bg-app/20' : 'bg-white/5'
          }`}>{counts.all}</span>
        </button>
        <button
          onClick={() => setPlatformFilter('youtube')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            platformFilter === 'youtube'
              ? 'bg-red-600 text-white'
              : 'bg-surface border border-white/5 text-secondary hover:text-primary hover:border-white/10'
          }`}>
          <Youtube className="w-4 h-4" />
          YouTube
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            platformFilter === 'youtube' ? 'bg-white/20' : 'bg-white/5'
          }`}>{counts.youtube}</span>
        </button>
        <button
          onClick={() => setPlatformFilter('netflix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            platformFilter === 'netflix'
              ? 'bg-[#e50914] text-white'
              : 'bg-surface border border-white/5 text-secondary hover:text-primary hover:border-white/10'
          }`}>
          <Film className="w-4 h-4" />
          Netflix
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            platformFilter === 'netflix' ? 'bg-white/20' : 'bg-white/5'
          }`}>{counts.netflix}</span>
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {loadState === 'loading' ? '—' : filteredVideos.length}
            </div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              Videos Tracked
            </div>
          </div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {loadState === 'loading' ? '—' : filteredVideos.filter(v =>
              (language === 'uk' ? v.has_ukrainian : v.has_korean) === 1
            ).length}
            </div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              With {languageName} Subs
            </div>
          </div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            platformFilter === 'netflix' ? 'bg-[#e50914]/10 text-[#e50914]' : 'bg-red-500/10 text-red-500'
          }`}>
            {platformFilter === 'netflix' ? <Film className="w-5 h-5" /> : <Youtube className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {platformFilter === 'all' ? 'All' : platformFilter === 'netflix' ? 'Netflix' : 'YouTube'}
            </div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              Platform
            </div>
          </div>
        </div>
      </div>

      {/* States */}
      <AnimatePresence mode="wait">
        {loadState === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
            <p className="text-secondary text-sm">Loading watch history…</p>
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
            <p className="text-secondary text-sm">Make sure the Deadbird server is running and accessible.</p>
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
            className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
              <Tv className="w-7 h-7 text-accent" />
            </div>
            <p className="text-primary font-semibold">No videos tracked yet</p>
            <p className="text-secondary text-sm text-center max-w-sm">
              Watch any {languageName} video on YouTube or Netflix — the Deadbird extension will track it automatically.
            </p>
          </motion.div>
        )}

        {loadState === 'loaded' && (
          <motion.div
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
                        isNetflix ? 'bg-[#e50914]' : 'bg-red-600'
                      }`}>
                        {isNetflix ? (
                          <>
                            <Film className="w-3 h-3" />
                            Netflix
                          </>
                        ) : (
                          <>
                            <Youtube className="w-3 h-3 fill-current" />
                            YouTube
                          </>
                        )}
                      </div>
                      {/* Language badge */}
                      {(language === 'uk' ? video.has_ukrainian : video.has_korean) === 1 && (
                        <div className="absolute top-2 right-2 bg-accent/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-app">
                          {language === 'uk' ? 'UK' : 'KO'} + EN
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
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-4 h-4 text-muted" />
                        </a>
                      </div>

                      <p className="text-xs text-muted font-mono mb-3">
                        {isNetflix ? netflixId : video.video_id}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-auto">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Clock className="w-3.5 h-3.5" />
                          {formatTrackedAt(video.tracked_at)}
                        </div>
                        {(language === 'uk' ? video.has_ukrainian : video.has_korean) === 1 && (
                          <div className="flex items-center gap-1.5 text-xs text-accent/80 bg-accent/5 px-2 py-0.5 rounded border border-accent/10">
                            <BookOpen className="w-3 h-3" />
                            {languageName} subtitles
                          </div>
                        )}
                        {(language === 'uk' ? video.has_ukrainian : video.has_korean) === 0 && (
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
    </div>
  );
}
