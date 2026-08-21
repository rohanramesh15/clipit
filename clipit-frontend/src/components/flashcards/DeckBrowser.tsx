import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ExternalLink, Film, PlayIcon, SearchIcon, Trash2, X } from 'lucide-react';
import { TrackedVideo } from '../../types/flashcards';
import { relativeDay } from '../../utils/flashcardStorage';

interface DeckBrowserProps {
  videos: TrackedVideo[];
  wordCounts: Record<string, number>;
  dueCounts: Record<string, number>;
  onStudyVideo: (videoId: string) => void;
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

function videoUrlFor(video: TrackedVideo): string {
  if (video.video_id.startsWith('netflix_')) {
    return `https://www.netflix.com/watch/${video.video_id.replace('netflix_', '')}`;
  }
  return `https://www.youtube.com/watch?v=${video.video_id}`;
}

export function DeckBrowser({ videos, wordCounts, dueCounts, onStudyVideo, onDeleteVideo }: DeckBrowserProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('due');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<TrackedVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsSortOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const currentSort = sorts.find((option) => option.value === sort) ?? sorts[0];

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
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-subtle pb-4">
        <h2 id="library-heading" className="font-heading text-card-title text-primary">
          Your videos
        </h2>

        <div className="flex flex-1 items-center justify-end gap-3">
          <label className="relative w-full max-w-xs">
            <span className="sr-only">Search videos</span>
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisible(PAGE_SIZE);
              }}
              placeholder="Search a video"
              className="w-full rounded-xl border border-subtle bg-surface py-2.5 pl-9 pr-3 text-body-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <div className="relative shrink-0" ref={sortRef}>
            <button
              type="button"
              onClick={() => setIsSortOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={isSortOpen}
              className="flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
            >
              {currentSort.label}
              <ChevronDown
                className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isSortOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              <span className="sr-only">Sort videos</span>
            </button>

            <AnimatePresence>
              {isSortOpen && (
                <motion.ul
                  role="listbox"
                  aria-label="Sort videos"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute right-0 top-full z-20 mt-2 w-48 origin-top-right rounded-xl border border-subtle bg-app p-2 shadow-lg"
                >
                  {sorts.map((option) => {
                    const isSelected = option.value === sort;
                    return (
                      <li key={option.value} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => {
                            setSort(option.value);
                            setVisible(PAGE_SIZE);
                            setIsSortOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-sm transition-colors duration-150 ease-swift ${
                            isSelected ? 'bg-blush font-medium text-accent' : 'text-secondary hover:bg-surface-hover hover:text-primary'
                          }`}
                        >
                          <span className="flex-1 text-left">{option.label}</span>
                          {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-body text-muted">
          {videos.length === 0 ? 'No videos tracked yet.' : `No videos match "${query}".`}
        </p>
      ) : (
        <ul>
          {shown.map((video) => {
            const due = dueCounts[video.video_id] ?? 0;
            const count = wordCounts[video.video_id];
            const isNetflix = sourceOf(video) === 'Netflix';
            return (
              <li key={video.video_id} className="flex items-center gap-5 border-b border-subtle py-4">
                <a
                  href={videoUrlFor(video)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open on ${sourceOf(video)}`}
                  className="group/thumb relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-hover"
                >
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
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 ease-swift group-hover/thumb:bg-black/40 group-hover/thumb:opacity-100">
                    <ExternalLink className="h-4 w-4 text-[#ffffff]" aria-hidden="true" />
                  </div>
                </a>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-semibold text-primary">{video.title}</p>
                  <p className="mt-0.5 truncate text-body-sm text-muted">
                    {sourceOf(video)} · {relativeDay(video.tracked_at)}
                    {count !== undefined && ` · ${count} words`}
                  </p>
                </div>
                <p
                  className={`hidden w-20 shrink-0 text-right text-body-sm font-semibold sm:block ${
                    due > 0 ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {count === undefined ? 'Counting…' : due > 0 ? `${due} due` : 'Caught up'}
                </p>
                <button
                  onClick={() => onStudyVideo(video.video_id)}
                  disabled={due === 0}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-surface-hover px-3.5 py-2 text-body-sm font-semibold text-primary transition-colors duration-150 ease-swift enabled:hover:bg-blush disabled:opacity-40"
                >
                  <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Review
                </button>
                <button
                  onClick={() => setShowDeleteVideoConfirm(video)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
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
          className="mt-6 w-full rounded-xl py-2.5 text-body-sm font-semibold text-muted transition-colors duration-150 ease-swift hover:text-primary"
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
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse/40 p-5"
            onClick={() => !isDeletingVideo && setShowDeleteVideoConfirm(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-video-title"
              aria-describedby="delete-video-description"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="relative w-full max-w-md rounded-2xl border border-subtle bg-app p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowDeleteVideoConfirm(null)}
                disabled={isDeletingVideo}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </button>

              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-error/10 text-error" aria-hidden="true">
                <Trash2 className="h-5 w-5" />
              </span>
              <h3 id="delete-video-title" className="mt-4 font-heading text-card-title font-medium text-primary">
                Delete video and flashcards?
              </h3>
              <p id="delete-video-description" className="mt-2 text-body text-secondary">
                <span className="font-semibold text-primary">{showDeleteVideoConfirm.title}</span> will be removed from
                your watch history along with all flashcards made from its words.
              </p>
              <div className="mt-6 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteVideoConfirm(null)}
                  disabled={isDeletingVideo}
                  className="w-full rounded-xl px-4 py-2.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteVideo}
                  disabled={isDeletingVideo}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-error px-4 py-2.5 text-body-sm font-semibold text-white transition-colors duration-150 ease-swift hover:bg-error/90 disabled:opacity-70"
                >
                  {isDeletingVideo ? (
                    <>
                      Deleting…
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
