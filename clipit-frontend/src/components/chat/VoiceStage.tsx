import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LanguagesIcon,
  MessageSquarePlusIcon,
  RotateCcwIcon,
  Volume2Icon,
} from 'lucide-react';
import type { ChatMessage, SavedWord } from '../../types/chat';
import { ActionButton } from './MessageActions';
import { TappableText } from './TappableText';
import { VoiceOrb, type OrbState } from './VoiceOrb';

interface VoiceStageProps {
  language: string;
  tutorInitial: string;
  tutorTurn?: ChatMessage;
  lastUserTurn?: ChatMessage;
  orbState: OrbState;
  /** In-progress transcript of what's currently being heard from the mic. */
  heard: string;
  savedWords: SavedWord[];
  onSaveWord: (word: SavedWord) => void;
  onRegenerate: () => void;
  onSuggest: () => void;
  onListen: (text: string, onStart: () => void, onEnd: () => void) => void;
  regenerating: boolean;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function VoiceStage({
  language,
  tutorInitial,
  tutorTurn,
  lastUserTurn,
  orbState,
  heard,
  savedWords,
  onSaveWord,
  onRegenerate,
  onSuggest,
  onListen,
  regenerating,
}: VoiceStageProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // The turn right after the learner's is the one carrying feedback on it.
  const correction = tutorTurn?.correction;

  return (
    <div className="flex flex-col items-center px-4 text-center">
      <VoiceOrb state={orbState} initial={tutorInitial} />

      {/* What the tutor just said — the one thing that matters right now. */}
      <div className="mt-5 max-w-2xl">
        <p className="text-card-title font-medium text-primary">
          {tutorTurn ? (
            <TappableText
              text={tutorTurn.text}
              language={language}
              targets={tutorTurn.targets}
              savedWords={savedWords}
              onSaveWord={onSaveWord}
            />
          ) : null}
        </p>

        <AnimatePresence initial={false}>
          {showTranslation && tutorTurn?.translation && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden text-body text-muted"
            >
              <span className="mt-2 block">{tutorTurn.translation}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {tutorTurn && (
        <div className="mt-1.5 flex items-center gap-1">
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
            onClick={() => onListen(tutorTurn.text, () => setSpeaking(true), () => setSpeaking(false))}
          >
            <Volume2Icon className="size-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Rephrase" onClick={onRegenerate} disabled={regenerating}>
            <RotateCcwIcon className="size-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Suggest" onClick={onSuggest}>
            <MessageSquarePlusIcon className="size-4" aria-hidden="true" />
          </ActionButton>
        </div>
      )}

      {/* Your own last turn, kept quiet so recognition can be checked. */}
      <div className="mt-8 min-h-[3.5rem] max-w-2xl">
        <AnimatePresence mode="wait" initial={false}>
          {heard ? (
            <motion.p
              key="heard"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
              className="text-lead text-accent"
            >
              {heard}
            </motion.p>
          ) : lastUserTurn ? (
            <motion.div
              key={lastUserTurn.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: EASE }}
            >
              <p className="text-lead text-secondary">“{lastUserTurn.text}”</p>

              {correction && (
                <div className="mt-1.5 flex items-center justify-center gap-4 text-meta">
                  <button
                    type="button"
                    onClick={() => setShowCorrection((v) => !v)}
                    aria-expanded={showCorrection}
                    className="text-muted underline decoration-1 underline-offset-4 hover:text-primary"
                  >
                    {showCorrection ? 'Hide' : 'Better way to say'}
                  </button>
                </div>
              )}

              <AnimatePresence initial={false}>
                {showCorrection && correction && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 rounded-2xl bg-surface p-4 text-left">
                      <p className="text-body font-medium text-primary">{correction.correct}</p>
                      <p className="mt-1.5 text-body-sm text-secondary">{correction.why_en}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
