import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRightIcon, CheckIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import type { ChatMessage, TargetWord } from '../../types/chat';

interface Coaching {
  id: string;
  english: string;
  corrected: string;
  explanation: string;
  advancedTopic: string;
  advancedDetail: string;
  loading: boolean;
}

interface CoachDrawerProps {
  targets: TargetWord[];
  usedLemmas: Set<string>;
  openWord: string | null;
  onToggleWord: (lemma: string) => void;
  messages: ChatMessage[];
  coachings: Coaching[];
  advancedOpenId: string | null;
  onToggleAdvanced: (id: string) => void;
  onJumpToMessage: (id: string) => void;
  onClose: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

/** Encouragement scales with how far through the words you are. */
function encouragement(used: number, total: number): string {
  if (used === 0) return 'Work one of these into your next answer — it\'ll come up naturally.';
  if (used === total) return 'Every word from the video, spoken. That is the whole set.';
  if (used === total - 1) return 'One left. You are almost through the set.';
  return `${used} down. Your accent on these is getting steadier.`;
}

export function CoachDrawer({
  targets,
  usedLemmas,
  openWord,
  onToggleWord,
  messages,
  coachings,
  advancedOpenId,
  onToggleAdvanced,
  onJumpToMessage,
  onClose,
}: CoachDrawerProps) {
  const used = usedLemmas.size;
  const next = targets.find((target) => !usedLemmas.has(target.lemma));

  const corrections = messages
    .map((m, i) => ({ m, said: i > 0 ? messages[i - 1].text : '' }))
    .filter(({ m }) => m.role === 'assistant' && m.correction);

  return (
    <motion.aside
      initial={{ x: 24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 24, opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      aria-label="Session coach"
      className="absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-full flex-col border-l border-subtle bg-app shadow-pop xl:static xl:z-auto xl:shadow-none"
    >
      <div className="flex h-16 shrink-0 items-center justify-between px-6">
        <h2 className="font-heading text-body font-semibold text-primary">Coach</h2>
        <Tooltip label="Close" placement="bottom">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close coach panel"
            className="inline-flex items-center rounded-xl p-2 text-secondary transition-colors duration-150 ease-swift hover:text-primary"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {targets.length > 0 && (
          <>
            <p className="text-body text-secondary" aria-live="polite">
              {encouragement(used, targets.length)}
            </p>

            {next && (
              <div className="mt-4 rounded-2xl bg-accent-soft px-5 py-4">
                <p className="text-meta text-accent">Try this one next</p>
                <p className="mt-1.5 font-heading text-card-title text-primary">{next.lemma}</p>
                <p className="text-body-sm text-secondary">{next.gloss}</p>
                {next.clipLine && (
                  <p className="mt-2 border-l-2 border-accent-ring pl-3 text-body-sm text-secondary">
                    "{next.clipLine}"
                  </p>
                )}
              </div>
            )}

            <ul className="mt-4">
              {targets.map((target) => {
                const isDone = usedLemmas.has(target.lemma);
                const isNext = target.lemma === next?.lemma;
                const open = openWord === target.lemma;
                if (isNext) return null;

                return (
                  <li key={target.lemma}>
                    <button
                      type="button"
                      onClick={() => onToggleWord(target.lemma)}
                      aria-expanded={open}
                      className="flex w-full items-baseline gap-2 rounded-lg py-2 text-left transition-colors duration-150 ease-swift hover:bg-surface-hover"
                    >
                      <span className={`text-body ${isDone ? 'text-muted' : 'font-medium text-primary'}`}>
                        {target.lemma}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-meta text-muted">{target.gloss}</span>
                      {isDone && <CheckIcon className="size-4 shrink-0 self-center text-accent" aria-label="Said" />}
                    </button>

                    <AnimatePresence initial={false}>
                      {open && target.clipLine && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <p className="ml-0 border-l-2 border-subtle py-1 pl-3 text-meta text-secondary">
                            "{target.clipLine}"
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <section className="mt-7">
          <h3 className="text-body-sm font-semibold text-primary">Fixes</h3>
          {corrections.length === 0 ? (
            <p className="mt-1.5 text-body-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {corrections.map(({ m, said }) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToMessage(m.id)}
                    className="group flex w-full items-start gap-2 rounded-xl border-l-2 border-subtle py-1.5 pl-3 pr-2 text-left transition-colors duration-150 ease-swift hover:border-accent hover:bg-surface-hover"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-meta text-muted line-through">{said}</span>
                      <span className="mt-0.5 block text-body-sm font-medium text-primary">{m.correction!.correct}</span>
                      <span className="mt-0.5 block text-meta text-secondary">{m.correction!.why_en}</span>
                    </span>
                    <ArrowUpRightIcon
                      className="mt-0.5 size-3.5 shrink-0 text-muted opacity-0 transition-opacity duration-150 ease-swift group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {coachings.length > 0 && (
          <section className="mt-7">
            <h3 className="text-body-sm font-semibold text-primary">Said in English</h3>
            <ul className="mt-2.5 space-y-3">
              {[...coachings].reverse().map((coaching, index) => {
                const isLatest = index === 0;
                const isAdvancedOpen = advancedOpenId === coaching.id;
                return (
                  <li key={coaching.id}>
                    <button
                      type="button"
                      onClick={() => onJumpToMessage(coaching.id)}
                      className="group block w-full rounded-2xl bg-surface p-4 text-left transition-colors duration-150 ease-swift hover:bg-surface-hover"
                    >
                      <span className="flex items-center justify-between gap-2">
                        {isLatest && (
                          <span className="text-meta font-semibold uppercase tracking-wide text-accent">Just now</span>
                        )}
                        <ArrowUpRightIcon
                          className="ml-auto size-3.5 shrink-0 text-muted opacity-0 transition-opacity duration-150 ease-swift group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </span>
                      <span className={`block text-lead font-medium text-primary ${isLatest ? 'mt-1' : ''}`}>
                        {coaching.loading ? '…' : (coaching.corrected || '—')}
                      </span>
                    </button>

                    {!coaching.loading && coaching.explanation && (
                      <div className="mt-2 rounded-2xl bg-accent-hover p-4">
                        <p className="text-meta font-semibold uppercase tracking-wide text-on-accent/85">Explanation</p>
                        <p className="mt-2 text-body-sm leading-relaxed text-on-accent">{coaching.explanation}</p>
                        {coaching.advancedDetail && (
                          <button
                            type="button"
                            onClick={() => onToggleAdvanced(coaching.id)}
                            aria-expanded={isAdvancedOpen}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-app px-3 py-1.5 text-body-sm font-semibold text-accent-hover"
                          >
                            <SparklesIcon className="w-4 h-4" aria-hidden="true" />
                            {isAdvancedOpen ? 'Hide advanced feedback' : 'Advanced feedback'}
                          </button>
                        )}
                      </div>
                    )}

                    <AnimatePresence initial={false}>
                      {isAdvancedOpen && coaching.advancedDetail && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 border-t border-subtle px-1 pt-3">
                            {coaching.advancedTopic && (
                              <h4 className="font-heading font-bold text-accent-hover">{coaching.advancedTopic}</h4>
                            )}
                            <p className="mt-2 text-body-sm leading-relaxed text-primary">{coaching.advancedDetail}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </motion.aside>
  );
}
