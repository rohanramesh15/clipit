import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage, SavedWord, TargetWord } from '../../types/chat';
import { lemmasUsedIn } from '../../lib/targetWords';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { Persona } from '../ai-elements/persona';

interface MessageListProps {
  messages: ChatMessage[];
  language: string;
  targetWords: TargetWord[];
  thinking: boolean;
  savedWords: SavedWord[];
  onSaveWord: (word: SavedWord) => void;
  onListen: (text: string, turnId: number | undefined, onStart: () => void, onEnd: () => void) => void;
  onStopListen: () => void;
  romanized: Record<string, string>;
  revealedCorrections: Set<string>;
  onRevealCorrection: (id: string) => void;
  correctionVerdicts: Record<string, 'fine' | 'wrong'>;
  onCorrectionFeedback: (id: string, turnId: number | undefined, verdict: 'fine' | 'wrong') => void;
  /** Briefly ringed and scrolled to — set when the learner jumps here from a Coach drawer entry. */
  highlightId?: string | null;
}

export function MessageList({
  messages,
  language,
  targetWords,
  thinking,
  savedWords,
  onSaveWord,
  onListen,
  onStopListen,
  romanized,
  revealedCorrections,
  onRevealCorrection,
  correctionVerdicts,
  onCorrectionFeedback,
  highlightId,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  /* Turns already on screen at mount are history — they arrive, they don't perform. */
  const historyIds = useRef(new Set(messages.map((m) => m.id)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  return (
    <div className="flex flex-col gap-7">
      {messages.map((message) => (
        <div
          key={message.id}
          id={`msg-${message.id}`}
          className={`rounded-2xl transition-shadow duration-300 ease-swift ${
            highlightId === message.id ? 'ring-2 ring-accent-ring ring-offset-2 ring-offset-app' : ''
          }`}
        >
          {message.role === 'assistant' ? (
            <AssistantMessage
              message={message}
              language={language}
              animateIn={!historyIds.current.has(message.id)}
              savedWords={savedWords}
              onSaveWord={onSaveWord}
              onListen={onListen}
              onStopListen={onStopListen}
              romanized={romanized[message.id]}
              revealed={revealedCorrections.has(message.id)}
              onRevealCorrection={() => onRevealCorrection(message.id)}
              verdict={correctionVerdicts[message.id]}
              onCorrectionFeedback={(verdict) => onCorrectionFeedback(message.id, message.turnId, verdict)}
            />
          ) : (
            <UserMessage
              message={message}
              animateIn={!historyIds.current.has(message.id)}
              usedTargets={lemmasUsedIn(message.text, targetWords)}
            />
          )}
        </div>
      ))}

      {thinking && (
        <div className="flex items-center gap-4" role="status" aria-live="polite">
          <div aria-hidden="true" className="shrink-0">
            <Persona state="thinking" className="size-9" />
          </div>
          <span className="flex items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="size-1.5 rounded-full bg-accent"
                animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: dot * 0.14 }}
              />
            ))}
            <span className="sr-only">Your tutor is writing</span>
          </span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
