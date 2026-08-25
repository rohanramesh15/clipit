import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { SingleSelectFilter } from './filters/filter-controls';

export type WordStatus = 'due' | 'learning' | 'new';

export interface QueuedWord {
  id: string;
  word: string;
  romanization?: string;
  meaning: string;
  video: string;
  status: WordStatus;
}

const FILTERS: { id: 'all' | WordStatus; label: string }[] = [
  { id: 'due', label: 'Due' },
  { id: 'learning', label: 'Learning' },
  { id: 'new', label: 'New' },
  { id: 'all', label: 'All' },
];

const STATUS_LABELS: Record<WordStatus, string> = {
  due: 'Due',
  learning: 'Learning',
  new: 'New',
};

const STATUS_STYLES: Record<WordStatus, string> = {
  due: 'bg-blush text-accent',
  learning: 'bg-surface-hover text-secondary',
  new: 'border border-medium text-secondary',
};

const WORDS_PER_PAGE = 7;

interface WordQueueProps {
  words: QueuedWord[];
  languageName: string;
  sourceVideoCount?: number;
  onRefresh?: () => void;
}

export function WordQueue({
  words,
  languageName,
  sourceVideoCount = 0,
  onRefresh,
}: WordQueueProps) {
  const [filter, setFilter] = useState<'all' | WordStatus>('all');
  const [page, setPage] = useState(0);
  const isEmpty = words.length === 0;
  const visible = filter === 'all' ? words : words.filter((word) => word.status === filter);
  const totalPages = Math.max(1, Math.ceil(visible.length / WORDS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedWords = visible.slice(currentPage * WORDS_PER_PAGE, (currentPage + 1) * WORDS_PER_PAGE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const selectFilter = (nextFilter: 'all' | WordStatus) => {
    setFilter(nextFilter);
    setPage(0);
  };

  return (
    <section aria-labelledby="queue-heading" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h2 id="queue-heading" className="font-heading text-card-title font-medium text-primary">
            Your practice words
          </h2>
          <p className="mt-1 text-body-sm text-muted">Selected from the videos you watched.</p>
        </div>

        {!isEmpty && (
          <SingleSelectFilter
            label="Filter words"
            options={FILTERS.map((option) => ({
              value: option.id,
              label: option.label,
              count: option.id === 'all' ? words.length : words.filter((word) => word.status === option.id).length,
            }))}
            value={filter}
            onValueChange={selectFilter}
            className="max-w-full overflow-x-auto"
          />
        )}
      </div>

      {isEmpty ? (
        <div className="mt-6 rounded-2xl border border-dashed border-medium px-6 py-10 text-center">
          {sourceVideoCount > 0 ? (
            <>
              <p className="text-body text-secondary">
                No words available yet.
              </p>
              <p className="mt-1 text-body-sm text-muted">
                Keep watching with the extension active, then check again.
              </p>
              {onRefresh && (
                <Button
                  type="button"
                  onClick={onRefresh}
                  variant="ghost"
                  size="sm"
                  className="mt-4 text-accent"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Check again
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-body text-secondary">Nothing clipped yet.</p>
              <p className="mt-1 text-body-sm text-muted">
                Watch a {languageName} video with the extension on, and words show up here.
              </p>
            </>
          )}
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-medium px-6 py-10 text-center text-body text-muted">
          Nothing in this bucket right now.
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-subtle overflow-hidden rounded-2xl border border-subtle bg-surface">
          {pagedWords.map((word, index) => (
            <motion.li
              key={word.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(index, 8) * 0.03, ease: [0.23, 1, 0.32, 1] }}
            >
              <button
                type="button"
                className="group flex w-full items-center gap-5 px-6 py-4 text-left transition-colors duration-150 ease-swift hover:bg-surface-hover"
              >
                <span className="min-w-0">
                  <span className="block truncate text-lead font-semibold text-primary">{word.word}</span>
                  {word.romanization && <span className="block text-meta text-muted">{word.romanization}</span>}
                </span>

                <span className="hidden min-w-0 flex-1 truncate text-body text-secondary sm:block">{word.meaning}</span>
                <span className="hidden min-w-0 max-w-[14rem] truncate text-body-sm text-muted lg:block">{word.video}</span>

                <span className="ml-auto flex shrink-0 items-center gap-3">
                  <span className={`rounded-md px-2.5 py-1 text-meta font-semibold ${STATUS_STYLES[word.status]}`}>
                    {STATUS_LABELS[word.status]}
                  </span>
                  <ChevronRight
                    className="h-5 w-5 shrink-0 text-muted transition-transform duration-150 ease-swift group-hover:translate-x-1"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </span>
              </button>
            </motion.li>
          ))}
          </ul>
          {visible.length > WORDS_PER_PAGE && (
            <nav aria-label="Word list pagination" className="mt-4 flex items-center justify-center gap-3">
            <Button
              type="button"
              aria-label="Go back one page"
              onClick={() => setPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-transparent hover:text-secondary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <p className="text-body-sm text-muted">
              Page {currentPage + 1} of {totalPages}
            </p>
            <Button
              type="button"
              aria-label="Go forward one page"
              onClick={() => setPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              variant="ghost"
              size="icon"
              className="h-9 w-9 hover:bg-transparent hover:text-secondary"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
