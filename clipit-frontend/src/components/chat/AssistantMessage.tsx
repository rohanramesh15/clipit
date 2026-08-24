import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LanguagesIcon, Loader2Icon, MessageSquarePlusIcon, RotateCcwIcon, Volume2Icon } from 'lucide-react';
import type { ChatMessage, SavedWord } from '../../types/chat';
import { ActionButton } from './MessageActions';
import { TappableText } from './TappableText';

interface AssistantMessageProps {
  message: ChatMessage;
  language: string;
  tutorInitial: string;
  animateIn: boolean;
  isLast: boolean;
  regenerating: boolean;
  savedWords: SavedWord[];
  onSaveWord: (word: SavedWord) => void;
  onRegenerate: () => void;
  onSuggest: () => void;
  onListen: (text: string, onStart: () => void, onEnd: () => void) => void;
  romanized?: string;
  revealed: boolean;
  onRevealCorrection: () => void;
  verdict?: 'fine' | 'wrong';
  onCorrectionFeedback: (verdict: 'fine' | 'wrong') => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function AssistantMessage({
  message,
  language,
  tutorInitial,
  animateIn,
  isLast,
  regenerating,
  savedWords,
  onSaveWord,
  onRegenerate,
  onSuggest,
  onListen,
  romanized,
  revealed,
  onRevealCorrection,
  verdict,
  onCorrectionFeedback,
}: AssistantMessageProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  return (
    <motion.article
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="group flex gap-4"
    >
      <div
        aria-hidden="true"
        className="mt-1 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-body-sm font-semibold text-accent"
      >
        {tutorInitial}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-lead font-medium text-primary">
          <TappableText
            text={message.text}
            language={language}
            targets={message.targets}
            savedWords={savedWords}
            onSaveWord={onSaveWord}
          />
        </p>

        {romanized ? <p className="mt-1 text-lead leading-relaxed text-muted">{romanized}</p> : null}

        <AnimatePresence initial={false}>
          {showTranslation && message.translation && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden text-body-sm text-muted"
            >
              <span className="mt-2 block border-l-2 border-subtle pl-3">{message.translation}</span>
            </motion.p>
          )}
        </AnimatePresence>

        <div
          className={`mt-2 flex items-center gap-1 transition-opacity duration-200 ease-swift ${
            isLast ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
          }`}
        >
          <ActionButton
            label={showTranslation ? 'Hide' : 'Translate'}
            active={showTranslation}
            onClick={() => setShowTranslation((v) => !v)}
          >
            <LanguagesIcon className="size-4" aria-hidden="true" />
          </ActionButton>

          <ActionButton
            label="Listen"
            active={speaking}
            onClick={() => onListen(message.text, () => setSpeaking(true), () => setSpeaking(false))}
          >
            {speaking ? (
              <span className="flex items-end gap-[2px]" aria-hidden="true">
                {[0, 1, 2].map((bar) => (
                  <motion.span
                    key={bar}
                    className="w-[2px] rounded-full bg-accent"
                    animate={{ height: [4, 12, 6, 10, 4] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear', delay: bar * 0.12 }}
                  />
                ))}
              </span>
            ) : (
              <Volume2Icon className="size-4" aria-hidden="true" />
            )}
          </ActionButton>

          {isLast && (
            <>
              <span className="mx-1 h-4 w-px bg-[color:var(--border-subtle)]" aria-hidden="true" />
              <ActionButton label="Rephrase" onClick={onRegenerate} disabled={regenerating}>
                {regenerating ? (
                  <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RotateCcwIcon className="size-4" aria-hidden="true" />
                )}
              </ActionButton>
              <ActionButton label="Suggest" onClick={onSuggest}>
                <MessageSquarePlusIcon className="size-4" aria-hidden="true" />
              </ActionButton>
            </>
          )}
        </div>

        {message.correction && (
          !revealed ? (
            <button
              type="button"
              onClick={onRevealCorrection}
              className="mt-2 inline-flex items-center gap-1.5 text-meta font-medium text-muted hover:text-secondary"
            >
              A better way to say that
            </button>
          ) : (
            <div className="mt-2 rounded-2xl bg-surface p-4">
              <p className="text-meta font-semibold uppercase tracking-wide text-muted">A better way to say that</p>
              <p className="mt-1 text-body font-medium text-accent">{message.correction.correct}</p>
              <p className="mt-1.5 text-body-sm text-secondary">{message.correction.why_en}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!!verdict}
                  onClick={() => onCorrectionFeedback('fine')}
                  className={`rounded-lg px-2.5 py-1 text-meta font-medium transition-colors ${
                    verdict === 'fine' ? 'bg-accent text-on-accent' : 'bg-surface-hover text-secondary hover:text-primary'
                  }`}
                >
                  Mine was fine
                </button>
                <button
                  type="button"
                  disabled={!!verdict}
                  onClick={() => onCorrectionFeedback('wrong')}
                  className={`rounded-lg px-2.5 py-1 text-meta font-medium transition-colors ${
                    verdict === 'wrong' ? 'bg-accent text-on-accent' : 'bg-surface-hover text-secondary hover:text-primary'
                  }`}
                >
                  Not right
                </button>
                {verdict && <span className="text-meta text-muted">thanks</span>}
              </div>
            </div>
          )
        )}
      </div>
    </motion.article>
  );
}
