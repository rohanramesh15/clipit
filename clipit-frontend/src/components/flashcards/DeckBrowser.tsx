import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ExternalLink, Film, PlayIcon } from 'lucide-react';
import { TrackedVideo } from '../../types/flashcards';
import { relativeDay } from '../../utils/flashcardStorage';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ExpandableSearch } from '../ExpandableSearch';

interface DeckBrowserProps {
  videos: TrackedVideo[];
  wordCounts: Record<string, number>;
  dueCounts: Record<string, number>;
  onStudyVideo: (videoId: string) => void;
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

export function DeckBrowser({ videos, wordCounts, dueCounts, onStudyVideo }: DeckBrowserProps) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('due');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

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

  return (
    <section aria-labelledby="library-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-subtle pb-4">
        <h2 id="library-heading" className="font-heading text-card-title font-medium text-primary">
          Your videos
        </h2>

        <div className="flex flex-1 items-center justify-end gap-3">
          <ExpandableSearch
            value={query}
            onChange={(value) => { setQuery(value); setVisible(PAGE_SIZE); }}
            label="Search videos"
            placeholder="Search a video"
          />
          <DropdownMenu open={isSortOpen} onOpenChange={setIsSortOpen} className="shrink-0">
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-10 rounded-xl bg-app px-4 text-body-sm font-semibold text-primary hover:bg-surface-hover">
                {currentSort.label}
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isSortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                <span className="sr-only">Sort videos</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Sort videos" className="w-48">
              {sorts.map((option) => {
                const isSelected = option.value === sort;
                return <DropdownMenuItem key={option.value} onSelect={() => { setSort(option.value); setVisible(PAGE_SIZE); }} className={isSelected ? 'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent' : ''}>
                  <span className="flex-1 text-left">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                </DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
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
                <Button
                  onClick={() => onStudyVideo(video.video_id)}
                  disabled={due === 0}
                  variant="secondary"
                  className="shrink-0 bg-surface-hover enabled:hover:bg-accent-soft"
                >
                  <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Review
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {visible < results.length && (
        <Button
          onClick={() => setVisible((count) => count + PAGE_SIZE)}
          variant="ghost"
          className="mt-6 w-full"
        >
          Show {Math.min(PAGE_SIZE, results.length - visible)} more of {results.length}
        </Button>
      )}
    </section>
  );
}
