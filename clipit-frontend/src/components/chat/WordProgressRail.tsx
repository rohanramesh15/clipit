import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, ListChecksIcon } from 'lucide-react';
import type { TargetWord } from '../../types/chat';

interface WordProgressControlProps {
  targets: TargetWord[];
  usedLemmas: Set<string>;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/** Horizontal header control with a checklist that opens immediately below it. */
export function WordProgressControl({ targets, usedLemmas }: WordProgressControlProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (targets.length === 0) return null;

  const usedCount = targets.filter((target) => usedLemmas.has(target.lemma)).length;
  const progress = (usedCount / targets.length) * 100;

  return (
    <div
      className="relative"
      aria-label="Conversation word progress"
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
        className="flex h-9 items-center gap-2 rounded-xl border border-subtle px-2.5 text-secondary transition-colors duration-150 ease-swift hover:border-medium hover:bg-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <ListChecksIcon className="size-4" aria-hidden="true" />
        <span
          className="relative h-1.5 w-14 overflow-hidden rounded-full bg-surface-hover sm:w-20"
          role="progressbar"
          aria-valuenow={usedCount}
          aria-valuemin={0}
          aria-valuemax={targets.length}
          aria-label="Words used this session"
        >
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full bg-accent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.28, ease: EASE }}
          />
        </span>
        <span className="text-meta font-semibold tabular-nums text-secondary">{usedCount}/{targets.length}</span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.section
            id={listId}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-subtle bg-app p-4 text-left shadow-pop"
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
                    <span className={`min-w-0 flex-1 text-left text-body-sm ${used ? 'text-muted line-through' : 'font-medium text-primary'}`}>
                      {target.surface || target.lemma}
                    </span>
                    {target.gloss && <span className="max-w-16 shrink-0 truncate text-right text-meta text-muted">{target.gloss}</span>}
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
