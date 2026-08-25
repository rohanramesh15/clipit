import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PencilLineIcon, XIcon } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { LoadingAnimation } from '../LoadingAnimation';
import type { SuggestedReply } from '../../types/chat';

interface SuggestionPanelProps {
  suggestions: SuggestedReply[];
  isLoading?: boolean;
  onPick: (reply: SuggestedReply) => void;
  onEdit: (reply: SuggestedReply) => void;
  onDismiss: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function SuggestionPanel({
  suggestions,
  isLoading = false,
  onPick,
  onEdit,
  onDismiss,
}: SuggestionPanelProps) {
  useEffect(() => {
    if (suggestions.length === 0) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement ||
        target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && suggestions[index]) {
        event.preventDefault();
        onPick(suggestions[index]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPick, suggestions]);

  return (
    <AnimatePresence initial={false}>
      {(suggestions.length > 0 || isLoading) && (
        <motion.section
          aria-label="Suggested replies"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-[0_8px_24px_rgba(75,45,43,0.05)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-subtle bg-sage-soft/60 px-4 py-2.5">
            <div>
              <p className="text-meta font-semibold uppercase tracking-[0.12em] text-secondary">Suggested replies</p>
              <p className="mt-0.5 text-body-sm text-muted">Choose one to keep the conversation going.</p>
            </div>
            {isLoading && <LoadingAnimation className="size-4 text-accent" label="Preparing suggestions" />}
          </div>

          <ul className="divide-y divide-[color:var(--border-subtle)]">
            {Array.from({ length: isLoading ? 3 : suggestions.length }, (_, index) => {
              const reply = suggestions[index];
              return (
                <li key={index} className="group relative flex min-h-[4.5rem] items-stretch">
                  {reply ? (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      onClick={() => onPick(reply)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover"
                    >
                      <kbd
                        aria-hidden="true"
                        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-sage-soft text-meta font-semibold text-secondary group-hover:bg-accent-soft group-hover:text-accent"
                      >
                        {index + 1}
                      </kbd>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-sm font-semibold text-primary">{reply.es}</span>
                        {reply.en && <span className="mt-0.5 block text-meta text-muted">{reply.en}</span>}
                      </span>
                    </motion.button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3" role="status" aria-label={`Preparing suggestion ${index + 1}`}>
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-sage-soft text-meta font-semibold text-secondary">{index + 1}</span>
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-body-sm text-muted">
                        <LoadingAnimation className="size-3.5 text-accent" />
                        Finding a natural reply…
                      </span>
                    </div>
                  )}

                  {reply && (
                    <Tooltip label="Edit">
                      <button
                        type="button"
                        onClick={() => onEdit(reply)}
                        aria-label={`Edit "${reply.es}" before sending`}
                        className="mr-2 grid w-9 shrink-0 place-items-center rounded-lg text-muted opacity-0 hover:bg-surface-hover hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <PencilLineIcon className="size-4" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-subtle px-3 py-1.5">
            <p className="text-meta text-muted">
              {isLoading ? 'Preparing three replies…' : `Press 1–${suggestions.length}`}
            </p>
            <Tooltip label="Dismiss">
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss suggestions"
                className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-primary"
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
