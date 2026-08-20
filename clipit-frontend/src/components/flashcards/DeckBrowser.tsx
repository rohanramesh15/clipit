import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Film, PlayIcon, SearchIcon, Trash2 } from 'lucide-react';
import { TrackedVideo } from '../../types/flashcards';
import { relativeDay } from '../../utils/flashcardStorage';

interface DeckBrowserProps {
  videos: TrackedVideo[];
  wordCounts: Record<string, number>;
  dueCounts: Record<string, number>;
  onStudyVideo: (videoId: string, title: string) => void;
  onDeleteVideo: (video: TrackedVideo) => Promise<void>;
}

type SortKey = 'due' | 'recent';

const PAGE_SIZE = 5;

const sorts: { value: SortKey; label: string }[] = [
  { value: 'due', label: 'Most due' },
  { value: 'recent', label: 'Recently watched' },
];

function sourceOf(video: TrackedVideo): 'YouTube' | 'Netflix' {
  return video.video_id.startsWith('netflix_') ? 'Netflix' : 'YouTube';
}

export function DeckBrowser({ videos, wordCounts, dueCounts, onStudyVideo, onDeleteVideo }: DeckBrowserProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('due');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<TrackedVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = videos.filter((video) => !needle || video.title.toLowerCase().includes(needle));

    return [...filtered].sort((a, b) => {
      if (sort === 'due') return (dueCounts[b.video_id] ?? 0) - (dueCounts[a.video_id] ?? 0);
      return b.tracked_at - a.tracked_at;
    });
  }, [videos, query, sort, dueCounts]);

  const shown = results.slice(0, visible);

  async function handleConfirmDeleteVideo() {
    if (!showDeleteVideoConfirm) return;
    setIsDeletingVideo(true);
    try {
      await onDeleteVideo(showDeleteVideoConfirm);
    } finally {
      setIsDeletingVideo(false);
      setShowDeleteVideoConfirm(null);
    }
  }

  return (
    <section aria-labelledby="library-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-sand-mid/40 pb-4">
        <h2 id="library-heading" className="font-heading text-card-title text-sand-deep">
          Your videos
        </h2>

        <div className="flex flex-1 items-center justify-end gap-3">
          <label className="relative w-full max-w-xs">
            <span className="sr-only">Search videos</span>
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-ink"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search a video"
              className="w-full rounded-xl border border-sand-mid/60 bg-sand-tint py-2.5 pl-9 pr-3 text-body-sm text-sand-deep placeholder:text-sand-ink/70 focus:border-sand-ink focus:outline-none"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setVisible(PAGE_SIZE);
            }}
            aria-label="Sort videos"
            className="shrink-0 rounded-xl border border-sand-mid/60 bg-sand-tint px-3 py-2.5 text-body-sm font-medium text-sand-deep focus:outline-none"
          >
            {sorts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-body text-sand-ink">
          {videos.length === 0 ? 'No videos tracked yet.' : `No videos match "${query}".`}
        </p>
      ) : (
        <ul>
          {shown.map((video) => {
            const due = dueCounts[video.video_id] ?? 0;
            const count = wordCounts[video.video_id];
            const isNetflix = sourceOf(video) === 'Netflix';
            return (
              <li key={video.video_id} className="flex items-center gap-5 border-b border-sand-mid/40 py-4">
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-sand-soft">
                  {isNetflix ? (
                    <div className="flex h-full w-full items-center justify-center bg-[#B20710]/10">
                      <Film className="h-5 w-5 text-[#B20710]" aria-hidden="true" />
                    </div>
                  ) : (
                    <img
                      src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-sand-deep">{video.title}</p>
                  <p className="mt-0.5 truncate text-body-sm text-sand-ink">
                    {sourceOf(video)} · {relativeDay(video.tracked_at)}
                    {count !== undefined && ` · ${count} words`}
                  </p>
                </div>
                <p
                  className={`hidden w-20 shrink-0 text-right text-body-sm font-semibold sm:block ${
                    due > 0 ? 'text-sand-ink' : 'text-sand-ink/60'
                  }`}
                >
                  {count === undefined ? 'Counting…' : due > 0 ? `${due} due` : 'Caught up'}
                </p>
                <button
                  onClick={() => onStudyVideo(video.video_id, video.title)}
                  disabled={due === 0}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sand-soft px-3.5 py-2 text-body-sm font-semibold text-sand-deep transition-colors duration-150 ease-swift enabled:hover:bg-sand-mid disabled:opacity-40"
                >
                  <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Review
                </button>
                <button
                  onClick={() => setShowDeleteVideoConfirm(video)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sand-ink/60 transition-colors hover:bg-red-500/10 hover:text-red-500"
                  title="Delete video"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {visible < results.length && (
        <button
          onClick={() => setVisible((count) => count + PAGE_SIZE)}
          className="mt-6 w-full rounded-xl py-2.5 text-body-sm font-semibold text-sand-ink transition-colors duration-150 ease-swift hover:text-sand-deep"
        >
          Show {Math.min(PAGE_SIZE, results.length - visible)} more of {results.length}
        </button>
      )}

      {/* Delete Video Confirmation Modal */}
      <AnimatePresence>
        {showDeleteVideoConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => !isDeletingVideo && setShowDeleteVideoConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <Trash2 className="h-6 w-6 text-red-500" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-center text-lead font-bold text-sand-deep">Delete Video & Flashcards?</h3>
              <p className="mb-2 text-center text-body-sm text-sand-ink">Are you sure you want to delete:</p>
              <p className="mb-4 line-clamp-2 px-4 text-center text-body-sm font-medium text-sand-deep">
                "{showDeleteVideoConfirm.title}"
              </p>
              <p className="mb-6 text-center text-meta text-sand-ink">
                This will remove the video from your watch history and delete all flashcards associated with it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteVideoConfirm(null)}
                  disabled={isDeletingVideo}
                  className="flex-1 rounded-xl bg-sand-soft px-4 py-2.5 font-medium text-sand-deep transition-colors hover:bg-sand-mid disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteVideo}
                  disabled={isDeletingVideo}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                >
                  {isDeletingVideo ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
