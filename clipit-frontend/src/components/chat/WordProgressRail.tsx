import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ListChecksIcon } from 'lucide-react';
import type { TargetWord } from '../../types/chat';

interface WordProgressRailProps {
  targets: TargetWord[];
  usedLemmas: Set<string>;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/** Hoverable session-word checklist anchored to the chat's left edge. */
export function WordProgressRail({ targets, usedLemmas }: WordProgressRailProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (targets.length === 0) return null;

  const usedCount = targets.filter((target) => usedLemmas.has(target.lemma)).length;
  const progress = (usedCount / targets.length) * 100;

  return (
    <aside className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 md:block" aria-label="Conversation word progress">
      <div
        className="relative"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={`${usedCount} of ${targets.length} conversation words used. Show word list.`}
          onClick={() => setOpen((value) => !value)}
          className="flex w-10 flex-col items-center rounded-2xl border border-subtle bg-app/95 px-2 py-3 text-muted shadow-pop backdrop-blur transition-colors duration-150 ease-swift hover:border-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        >
          <ListChecksIcon className="size-4" aria-hidden="true" />
          <span
            className="relative mt-2 h-24 w-1.5 overflow-hidden rounded-full bg-surface-hover"
            role="progressbar"
            aria-valuenow={usedCount}
            aria-valuemin={0}
            aria-valuemax={targets.length}
            aria-label="Words used this session"
          >
            <motion.span
              className="absolute inset-x-0 bottom-0 rounded-full bg-accent"
              animate={{ height: `${progress}%` }}
              transition={{ duration: 0.28, ease: EASE }}
            />
          </span>
          <span className="mt-2 text-meta font-semibold tabular-nums text-secondary">{usedCount}/{targets.length}</span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.section
              id={listId}
              initial={{ opacity: 0, x: -6, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: EASE }}
              className="absolute left-full top-1/2 ml-3 w-64 -translate-y-1/2 overflow-hidden rounded-2xl border border-subtle bg-app p-4 text-left shadow-pop"
            >
              <p className="text-body-sm font-semibold text-primary">Words to weave in</p>
              <p className="mt-0.5 text-meta text-muted">Use them in your own reply to complete the set.</p>
              <ul className="mt-3 space-y-1.5">
                {targets.map((target) => {
                  const used = usedLemmas.has(target.lemma);
                  return (
                    <li key={target.lemma} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <span className={`grid size-4 shrink-0 place-items-center rounded-full ${used ? 'bg-accent text-white' : 'border border-medium'}`}>
                        {used && <CheckIcon className="size-3" aria-label="Used" />}
                      </span>
                      <span className={`min-w-0 flex-1 text-body-sm ${used ? 'text-muted line-through' : 'font-medium text-primary'}`}>
                        {target.surface || target.lemma}
                      </span>
                      {target.gloss && <span className="max-w-24 truncate text-meta text-muted">{target.gloss}</span>}
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
