import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ALargeSmallIcon,
  LanguagesIcon,
  MessageSquarePlusIcon,
  RotateCcwIcon,
  Loader2Icon,
  Volume2Icon,
  XIcon,
} from 'lucide-react';
import type { ChatMessage, SavedWord } from '../../types/chat';
import { ActionButton } from './MessageActions';
import { TappableText } from './TappableText';
import { Persona, type PersonaState } from '../ai-elements/persona';

interface VoiceStageProps {
  language: string;
  tutorTurn?: ChatMessage;
  lastUserTurn?: ChatMessage;
  personaState: PersonaState;
  /** In-progress transcript of what's currently being heard from the mic. */
  heard: string;
  savedWords: SavedWord[];
  onSaveWord: (word: SavedWord) => void;
  onRegenerate: () => void;
  onSuggest: () => void;
  onListen: (text: string, turnId: number | undefined, onStart: () => void, onEnd: () => void) => void;
  onStopListen: () => void;
  regenerating: boolean;
  romanized?: string;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function VoiceStage({
  language,
  tutorTurn,
  lastUserTurn,
  personaState,
  heard,
  savedWords,
  onSaveWord,
  onRegenerate,
  onSuggest,
  onListen,
  onStopListen,
  regenerating,
  romanized,
}: VoiceStageProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showRomanized, setShowRomanized] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const romanizationPending = romanized === undefined;
  const romanizationReady = Boolean(romanized);
  // The turn right after the learner's is the one carrying feedback on it.
  const correction = tutorTurn?.correction;

  return (
    <div className="flex flex-col items-center px-4 text-center">
      <Persona state={personaState} className="size-20 sm:size-24" />

      {/* What the tutor just said — the one thing that matters right now. */}
      <div className="group">
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
          {showRomanized && romanized && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden text-lead leading-relaxed text-muted"
            >
              <span className="mt-1 block">{romanized}</span>
            </motion.p>
          )}
        </AnimatePresence>

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
        <div className="mt-1.5 flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 ease-swift focus-within:opacity-100 group-hover:opacity-100">
          <ActionButton
            label={romanizationPending ? 'Preparing Romanization' : showRomanized ? 'Hide' : 'Romanize'}
            active={showRomanized}
            disabled={!romanizationReady}
            onClick={() => setShowRomanized((v) => !v)}
          >
            {romanizationPending ? (
              <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ALargeSmallIcon className="size-4" aria-hidden="true" />
            )}
          </ActionButton>
          <ActionButton
            label={showTranslation ? 'Hide' : 'Translate'}
            active={showTranslation}
            onClick={() => setShowTranslation((v) => !v)}
          >
            <LanguagesIcon className="size-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton
            label={speaking ? 'Stop' : 'Listen'}
            active={speaking}
            onClick={() => {
              if (speaking) { onStopListen(); setSpeaking(false); }
              else onListen(tutorTurn.text, tutorTurn.turnId, () => setSpeaking(true), () => setSpeaking(false));
            }}
          >
            {speaking ? <XIcon className="size-4" aria-hidden="true" /> : <Volume2Icon className="size-4" aria-hidden="true" />}
          </ActionButton>
          <ActionButton label="Rephrase" onClick={onRegenerate} disabled={regenerating}>
            <RotateCcwIcon className="size-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton label="Suggest" onClick={onSuggest}>
            <MessageSquarePlusIcon className="size-4" aria-hidden="true" />
          </ActionButton>
        </div>
      )}
      </div>

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
              <p className="text-lead text-secondary">{lastUserTurn.text}</p>

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
