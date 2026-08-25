import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ALargeSmallIcon,
  LanguagesIcon,
  MessageSquarePlusIcon,
  RotateCcwIcon,
  Volume2Icon,
  XIcon,
} from 'lucide-react';
import type { ChatMessage, SavedWord } from '../../types/chat';
import { ActionButton } from './MessageActions';
import { TappableText } from './TappableText';
import { Persona, type PersonaState } from '../ai-elements/persona';
import { LoadingAnimation } from '../LoadingAnimation';
import { translate as translateText } from '../../services/converseV2';

interface VoiceStageProps {
  language: string;
  tutorTurn?: ChatMessage;
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
  rephrase?: {
    sequence: number;
    previousText: string;
    nextText: string;
    turnId: number;
  } | null;
  getRephraseAudioUrl: (turnId: number) => Promise<string>;
  onRephraseEnd: () => void;
  romanized?: string;
}

const EASE = [0.23, 1, 0.32, 1] as const;
const FALLBACK_TOKEN_CADENCE_MS = 220;
// The erase of the old sentence is a quick visual "clear", independent of
// the reveal cadence below (which stays synced to the replacement audio).
const REMOVAL_MS_PER_WEIGHT = 30;

function tokensForTiming(text: string): string[] {
  return text.match(/\S+\s*/gu) ?? (text ? [text] : []);
}

function tokenWeight(token: string): number {
  const spokenCharacters = Array.from(token.trim()).filter((character) => !/\s/u.test(character)).length || 1;
  const softPauses = (token.match(/[,;:，、]/gu) ?? []).length * 1.5;
  const fullPauses = (token.match(/[.!?…。！？]/gu) ?? []).length * 4;
  return spokenCharacters + softPauses + fullPauses;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function VoiceStage({
  language,
  tutorTurn,
  personaState,
  heard,
  savedWords,
  onSaveWord,
  onRegenerate,
  onSuggest,
  onListen,
  onStopListen,
  regenerating,
  rephrase,
  getRephraseAudioUrl,
  onRephraseEnd,
  romanized,
}: VoiceStageProps) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [showRomanized, setShowRomanized] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [fetchedTranslation, setFetchedTranslation] = useState('');
  const [translationLoading, setTranslationLoading] = useState(false);
  const [visibleText, setVisibleText] = useState(tutorTurn?.text ?? '');
  const romanizationPending = romanized === undefined;
  const translation = tutorTurn?.translation || fetchedTranslation;

  useEffect(() => {
    setShowTranslation(false);
    setFetchedTranslation('');
    setTranslationLoading(false);
  }, [tutorTurn?.id]);

  // Standard replies display at once. A Rephrase holds the old sentence here
  // until its deliberate erase-and-reveal sequence has completed.
  useEffect(() => {
    if (!rephrase) setVisibleText(tutorTurn?.text ?? '');
  }, [rephrase, tutorTurn?.text]);

  useEffect(() => {
    if (!rephrase) return;

    let cancelled = false;
    let audio: HTMLAudioElement | null = null;
    let audioUrl: string | null = null;
    let frame: number | null = null;
    const oldTokens = tokensForTiming(rephrase.previousText);
    const nextTokens = tokensForTiming(rephrase.nextText);
    const nextWeights = nextTokens.map(tokenWeight);
    const totalNextWeight = nextWeights.reduce((total, weight) => total + weight, 0) || 1;

    const finish = () => {
      if (cancelled) return;
      setVisibleText(rephrase.nextText);
      onRephraseEnd();
    };

    const revealWithoutAudio = async (millisecondsPerWeight: number) => {
      for (let index = 0; index < nextTokens.length; index += 1) {
        await wait(Math.max(80, tokenWeight(nextTokens[index]) * millisecondsPerWeight));
        if (cancelled) return;
        setVisibleText(nextTokens.slice(0, index + 1).join(''));
      }
      finish();
    };

    const run = async () => {
      setVisibleText(rephrase.previousText);
      try {
        audioUrl = await getRephraseAudioUrl(rephrase.turnId);
        if (cancelled) return;
        audio = new Audio(audioUrl);
        audio.preload = 'auto';
        await new Promise<void>((resolve, reject) => {
          audio?.addEventListener('loadedmetadata', () => resolve(), { once: true });
          audio?.addEventListener('error', () => reject(new Error('Could not load rephrase audio')), { once: true });
          audio?.load();
        });
      } catch {
        audio?.pause();
        audio = null;
      }
      if (cancelled) return;

      const millisecondsPerWeight = audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? (audio.duration * 1000) / totalNextWeight
        : FALLBACK_TOKEN_CADENCE_MS;

      // Start at the last token so the sentence contracts naturally. This
      // erase is deliberately quick and unrelated to the reveal cadence.
      for (let index = oldTokens.length - 1; index >= 0; index -= 1) {
        await wait(Math.max(20, tokenWeight(oldTokens[index]) * REMOVAL_MS_PER_WEIGHT));
        if (cancelled) return;
        setVisibleText(oldTokens.slice(0, index).join(''));
      }
      if (cancelled) return;
      setVisibleText('');

      if (!audio) {
        await revealWithoutAudio(millisecondsPerWeight);
        return;
      }

      const syncTokens = () => {
        if (cancelled || !audio) return;
        const spokenWeight = Math.min(audio.currentTime / audio.duration, 1) * totalNextWeight;
        let visibleCount = 1;
        let elapsedWeight = nextWeights[0] ?? 0;
        while (visibleCount < nextTokens.length && elapsedWeight <= spokenWeight) {
          elapsedWeight += nextWeights[visibleCount] ?? 0;
          visibleCount += 1;
        }
        setVisibleText(nextTokens.slice(0, visibleCount).join(''));
        if (!audio.ended) frame = window.requestAnimationFrame(syncTokens);
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', () => { void revealWithoutAudio(millisecondsPerWeight); }, { once: true });
      audio.play().then(syncTokens).catch(() => { void revealWithoutAudio(millisecondsPerWeight); });
    };

    void run();
    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      audio?.pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [getRephraseAudioUrl, onRephraseEnd, rephrase]);

  const toggleTranslation = () => {
    const next = !showTranslation;
    setShowTranslation(next);
    if (!next || translation || !tutorTurn || translationLoading) return;
    setTranslationLoading(true);
    translateText(tutorTurn.text, language)
      .then(setFetchedTranslation)
      .catch(() => setFetchedTranslation('Translation unavailable.'))
      .finally(() => setTranslationLoading(false));
  };

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
              displayText={visibleText}
              language={language}
              animateWords={tutorTurn.turnId === undefined}
              targets={tutorTurn.targets}
              savedWords={savedWords}
              onSaveWord={onSaveWord}
            />
          ) : null}
        </p>

        <AnimatePresence initial={false}>
          {showRomanized && (
            romanizationPending ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="mx-auto mt-1 flex h-7 items-center justify-center overflow-hidden"
                role="status"
                aria-label="Preparing romanization"
              >
                <LoadingAnimation className="size-5" />
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="overflow-hidden text-lead leading-relaxed text-muted"
              >
                <span className="mt-1 block">{romanized || 'Romanization unavailable.'}</span>
              </motion.p>
            )
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showTranslation && tutorTurn && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden text-body text-muted"
            >
              <span className="mt-2 block">
                {translationLoading ? <LoadingAnimation className="mx-auto size-5" label="Translating" /> : translation || 'Translation unavailable.'}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {tutorTurn && (
        <div className="mt-1.5 flex items-center justify-center gap-1 opacity-0 transition-opacity duration-200 ease-swift focus-within:opacity-100 group-hover:opacity-100">
          <ActionButton
            label={showRomanized ? 'Hide Romanization' : 'Romanize'}
            active={showRomanized}
            onClick={() => setShowRomanized((v) => !v)}
            disabled={regenerating}
          >
            <ALargeSmallIcon className="size-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton
            label={showTranslation ? 'Hide' : 'Translate'}
            active={showTranslation}
            onClick={toggleTranslation}
            disabled={regenerating}
          >
            <LanguagesIcon className="size-4" aria-hidden="true" />
          </ActionButton>
          <ActionButton
            label={speaking ? 'Stop' : 'Listen'}
            active={speaking}
            disabled={regenerating}
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
          <ActionButton label="Suggest" onClick={onSuggest} disabled={regenerating}>
            <MessageSquarePlusIcon className="size-4" aria-hidden="true" />
          </ActionButton>
        </div>
      )}
      </div>

      {/* Keep only the live recognition text in this focused voice view. Past
          learner turns remain in the transcript, rather than competing with
          the tutor's next response. */}
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
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
