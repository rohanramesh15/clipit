import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpDown, Film, Play, Search, Tv, Trash2, X } from 'lucide-react';
import { SortOption, TrackedVideo, VocabList } from '../../types/flashcards';

interface DeckBrowserProps {
  videos: TrackedVideo[];
  wordCounts: Record<string, number>;
  vocabLists: VocabList[];
  language: string;
  onStudyVideo: (videoId: string, title: string) => void;
  /** undefined means "study all my words" (every list combined) */
  onStudyVocabList: (listId?: number) => void;
  onStudyAllVideos: () => void;
  onDeleteVideo: (video: TrackedVideo) => Promise<void>;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'alphabetical', label: 'A-Z' },
  { value: 'oldest', label: 'Oldest' },
];

export function DeckBrowser({
  videos,
  wordCounts,
  vocabLists,
  language,
  onStudyVideo,
  onStudyVocabList,
  onStudyAllVideos,
  onDeleteVideo,
}: DeckBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [showDeleteVideoConfirm, setShowDeleteVideoConfirm] = useState<TrackedVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [studySelection, setStudySelection] = useState(videos.length > 0 ? 'all-videos' : 'my-words');
  const hasAppliedDefaultStudyMode = useRef(false);

  // Default the study selector to "my words" once vocab lists load, unless the
  // user's saved preference (or the absence of any videos) says otherwise.
  useEffect(() => {
    hasAppliedDefaultStudyMode.current = false;
  }, [language]);

  useEffect(() => {
    if (vocabLists.length === 0 || hasAppliedDefaultStudyMode.current) return;
    hasAppliedDefaultStudyMode.current = true;
    const defaultMode = localStorage.getItem('default_study_mode') || 'my-words';
    if (defaultMode === 'my-words' || videos.length === 0) {
      setStudySelection('my-words');
    }
  }, [vocabLists, videos.length]);

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

  function handleStudyClick() {
    if (studySelection === 'all-videos') onStudyAllVideos();
    else if (studySelection === 'my-words') onStudyVocabList(undefined);
    else onStudyVocabList(parseInt(studySelection, 10));
  }

  const filteredAndSortedVideos = [...videos]
    .filter((v) => !searchQuery.trim() || v.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (sortOption) {
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'oldest':
          return a.tracked_at - b.tracked_at;
        case 'recent':
        default:
          return b.tracked_at - a.tracked_at;
      }
    });

  function renderVideoRow(video: TrackedVideo, index: number) {
    const isNetflix = video.video_id.startsWith('netflix_');
    const count = wordCounts[video.video_id];

    return (
      <motion.div
        key={video.video_id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className="group overflow-hidden rounded-xl border border-sand-mid/50 bg-white/70 transition-colors hover:border-sand-ink/40"
      >
        <div className="flex items-center">
          <button
            onClick={() => onStudyVideo(video.video_id, video.title)}
            className="flex flex-1 items-center gap-4 p-4 text-left"
          >
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
              <div
                className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[8px] font-bold text-white ${
                  isNetflix ? 'bg-[#B20710]' : 'bg-[#FF0000]'
                }`}
              >
                {isNetflix ? 'N' : 'YT'}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-body-sm font-semibold text-sand-deep">{video.title}</h3>
              {count === undefined ? (
                <span className="text-meta text-sand-ink">Counting words…</span>
              ) : count === 0 ? (
                <span className="text-meta italic text-sand-ink">No words to practice yet</span>
              ) : (
                <span className="text-meta font-medium text-sand-ink">
                  {count} {count === 1 ? 'word' : 'words'} to practice
                </span>
              )}
            </div>

            <Play className="h-4 w-4 shrink-0 text-sand-ink opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
          </button>

          <div className="mr-2 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteVideoConfirm(video);
              }}
              className="rounded-lg p-2.5 text-sand-ink transition-colors hover:bg-red-500/10 hover:text-red-500"
              title="Delete video"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Choose what to study */}
      <div className="mb-8 rounded-2xl border border-sand-mid/60 bg-sand-tint p-5">
        <label className="mb-2 block text-body-sm font-medium text-sand-ink">Choose what to study</label>
        <div className="flex gap-3">
          <select
            value={studySelection}
            onChange={(e) => setStudySelection(e.target.value)}
            className="min-w-0 flex-1 appearance-none rounded-xl border border-sand-mid bg-white px-4 py-3.5 text-body font-medium text-sand-deep focus:outline-none focus:ring-2 focus:ring-sand-ink/40"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238f6227'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              backgroundSize: '20px',
              paddingRight: '44px',
            }}
          >
            {videos.length > 0 && (
              <option value="all-videos">All Videos ({videos.length} videos)</option>
            )}
            {vocabLists.length > 0 && (
              <option value="my-words">
                Study My Words ({vocabLists.reduce((sum, l) => sum + l.word_count, 0)} words)
              </option>
            )}
            {vocabLists.map((list) => (
              <option key={list.id} value={String(list.id)}>
                {list.name} ({list.word_count} words)
              </option>
            ))}
          </select>
          <button
            onClick={handleStudyClick}
            className="shrink-0 rounded-xl bg-sand-ink px-6 py-3.5 font-semibold text-white transition-colors duration-150 ease-swift hover:bg-sand-deep"
          >
            Study
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <h2 className="mb-4 text-meta font-bold uppercase tracking-wider text-sand-ink">Your videos</h2>

      {videos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand-mid bg-sand-tint/60 py-12 text-center">
          <Tv className="h-8 w-8 text-sand-ink" aria-hidden="true" />
          <p className="text-body-sm text-sand-ink">
            No videos tracked yet. Install the Clip It extension to start clipping words from what you watch.
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-ink" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-sand-mid/60 bg-sand-tint py-3 pl-11 pr-4 text-body-sm text-sand-deep placeholder:text-sand-ink/70 focus:border-sand-ink focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-sand-ink transition-colors hover:bg-sand-soft"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="mb-5 flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-sand-ink" aria-hidden="true" />
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSortOption(option.value)}
                className={`rounded-lg px-3.5 py-1.5 text-body-sm font-medium transition-colors duration-150 ease-swift ${
                  sortOption === option.value
                    ? 'bg-sand-ink text-white'
                    : 'bg-white/70 text-sand-ink hover:text-sand-deep'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Videos */}
          {filteredAndSortedVideos.length > 0 ? (
            <div className="space-y-3">{filteredAndSortedVideos.map((video, index) => renderVideoRow(video, index))}</div>
          ) : (
            <div className="py-16 text-center">
              <Search className="mx-auto mb-4 h-12 w-12 text-sand-ink" aria-hidden="true" />
              <p className="text-body text-sand-ink">No videos found for "{searchQuery}"</p>
            </div>
          )}
        </>
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
    </>
  );
}
