import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckIcon, Film, SparklesIcon, XIcon } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import type { ChatMessage, SavedWord, TargetWord } from '../../types/chat';

interface Coaching {
  english: string;
  corrected: string;
  explanation: string;
  advancedTopic: string;
  advancedDetail: string;
  loading: boolean;
}

interface CoachDrawerProps {
  deck: { id: string; title: string } | null;
  targets: TargetWord[];
  usedLemmas: Set<string>;
  openWord: string | null;
  onToggleWord: (lemma: string) => void;
  messages: ChatMessage[];
  savedWords: SavedWord[];
  latestCoaching: Coaching | null;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  onClose: () => void;
  onEndSession: () => void;
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
  deck,
  targets,
  usedLemmas,
  openWord,
  onToggleWord,
  messages,
  savedWords,
  latestCoaching,
  advancedOpen,
  onToggleAdvanced,
  onClose,
  onEndSession,
}: CoachDrawerProps) {
  const used = usedLemmas.size;
  const next = targets.find((target) => !usedLemmas.has(target.lemma));
  const isNetflix = deck?.id.startsWith('netflix_');

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
            {deck && (
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-hover">
                  {isNetflix ? (
                    <Film className="w-4 h-4 text-accent" />
                  ) : (
                    <img
                      src={`https://img.youtube.com/vi/${deck.id}/mqdefault.jpg`}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-primary">{deck.title}</p>
                  <p className="truncate text-meta text-muted">{isNetflix ? 'Netflix' : 'YouTube'}</p>
                </div>
              </div>
            )}

            <p className="mt-4 text-body text-secondary" aria-live="polite">
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
            <ul className="mt-2.5 space-y-2.5">
              {corrections.map(({ m, said }) => (
                <li key={m.id} className="border-l-2 border-subtle pl-3">
                  <p className="text-meta text-muted line-through">{said}</p>
                  <p className="mt-0.5 text-body-sm font-medium text-primary">{m.correction!.correct}</p>
                  <p className="mt-0.5 text-meta text-secondary">{m.correction!.why_en}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h3 className="text-body-sm font-semibold text-primary">Saved words</h3>
          {savedWords.length === 0 ? (
            <p className="mt-1.5 text-body-sm text-muted">Tap a word to save it.</p>
          ) : (
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {savedWords.map((word) => (
                <li key={word.lemma} className="rounded-md border border-subtle px-2.5 py-1.5 text-meta">
                  <span className="font-medium text-primary">{word.lemma}</span>
                  <span className="text-muted"> · {word.gloss}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {latestCoaching && (
          <section className="mt-7">
            <h3 className="text-body-sm font-semibold text-primary">Said in English</h3>
            <p className="mt-2 text-lead font-medium text-primary">
              {latestCoaching.loading ? '…' : (latestCoaching.corrected || '—')}
            </p>

            {!latestCoaching.loading && latestCoaching.explanation && (
              <div className="mt-3 rounded-2xl bg-accent-hover p-4">
                <p className="text-meta font-semibold uppercase tracking-wide text-on-accent/85">Explanation</p>
                <p className="mt-2 text-body-sm leading-relaxed text-on-accent">{latestCoaching.explanation}</p>
                {latestCoaching.advancedDetail && (
                  <button
                    type="button"
                    onClick={onToggleAdvanced}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-app px-3 py-1.5 text-body-sm font-semibold text-accent-hover"
                  >
                    <SparklesIcon className="w-4 h-4" aria-hidden="true" /> Advanced feedback
                  </button>
                )}
              </div>
            )}

            {advancedOpen && latestCoaching.advancedDetail && (
              <div className="mt-4 border-t border-subtle pt-4">
                {latestCoaching.advancedTopic && (
                  <h4 className="font-heading font-bold text-accent-hover">{latestCoaching.advancedTopic}</h4>
                )}
                <p className="mt-2 text-body-sm leading-relaxed text-primary">{latestCoaching.advancedDetail}</p>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="shrink-0 border-t border-subtle p-4">
        <button
          type="button"
          onClick={onEndSession}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          End session
        </button>
      </div>
    </motion.aside>
  );
}
