import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export type WordStatus = 'due' | 'learning' | 'new';

export interface QueuedWord {
  id: string;
  word: string;
  romanization?: string;
  meaning: string;
  video: string;
  status: WordStatus;
}

const STATUS_FILTERS: { id: WordStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'learning', label: 'Learning' },
  { id: 'new', label: 'Not started' },
];

const STATUS_STYLES: Record<WordStatus, string> = {
  due: 'bg-blush text-accent',
  learning: 'bg-sand-soft text-sand-ink',
  new: 'bg-dusk-soft text-dusk-ink',
};

const STATUS_LABELS: Record<WordStatus, string> = {
  due: 'Due',
  learning: 'Learning',
  new: 'Not started',
};

interface WordQueueProps {
  words: QueuedWord[];
}

export function WordQueue({ words }: WordQueueProps) {
  const [filter, setFilter] = useState<WordStatus | 'all'>('all');
  const visible = filter === 'all' ? words : words.filter((word) => word.status === filter);

  return (
    <section aria-labelledby="queue-heading" className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="queue-heading" className="font-heading text-card-title font-medium text-primary">
            Words from what you watched
          </h2>
          <p className="mt-1 text-body-sm text-muted">Clipped by the extension, waiting on your deck.</p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Filter words by status">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              aria-pressed={filter === option.id}
              className={`rounded-lg px-3 py-1.5 text-body-sm font-medium transition-colors duration-150 ease-swift ${
                filter === option.id ? 'bg-blush text-accent' : 'text-secondary hover:bg-surface-hover hover:text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-surface px-6 py-10 text-center text-body text-muted">
          Nothing in this bucket right now.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-subtle border-t border-subtle">
          {visible.map((word) => (
            <li key={word.id}>
              <button
                type="button"
                className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 py-4 text-left transition-colors duration-150 ease-swift hover:bg-surface-hover sm:grid-cols-[14rem_1fr_auto_auto]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-lead font-semibold text-primary">{word.word}</span>
                  {word.romanization && <span className="block text-meta text-muted">{word.romanization}</span>}
                </span>
                <span className="hidden truncate text-body text-secondary sm:block">{word.meaning}</span>
                <span className="hidden max-w-[16rem] truncate text-body-sm text-muted md:block">{word.video}</span>
                <span className="flex items-center gap-3 justify-self-end">
                  <span className={`shrink-0 rounded-md px-2.5 py-1 text-meta font-semibold ${STATUS_STYLES[word.status]}`}>
                    {STATUS_LABELS[word.status]}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted transition-transform duration-150 ease-swift group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
