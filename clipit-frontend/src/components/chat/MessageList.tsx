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
  regenerating: boolean;
  savedWords: SavedWord[];
  onSaveWord: (word: SavedWord) => void;
  onRegenerate: () => void;
  onSuggest: () => void;
  onListen: (text: string, turnId: number | undefined, onStart: () => void, onEnd: () => void) => void;
  onStopListen: () => void;
  romanized: Record<string, string>;
  revealedCorrections: Set<string>;
  onRevealCorrection: (id: string) => void;
  correctionVerdicts: Record<string, 'fine' | 'wrong'>;
  onCorrectionFeedback: (id: string, turnId: number | undefined, verdict: 'fine' | 'wrong') => void;
}

export function MessageList({
  messages,
  language,
  targetWords,
  thinking,
  regenerating,
  savedWords,
  onSaveWord,
  onRegenerate,
  onSuggest,
  onListen,
  onStopListen,
  romanized,
  revealedCorrections,
  onRevealCorrection,
  correctionVerdicts,
  onCorrectionFeedback,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  /* Turns already on screen at mount are history — they arrive, they don't perform. */
  const historyIds = useRef(new Set(messages.map((m) => m.id)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, thinking]);

  return (
    <div className="flex flex-col gap-7">
      {messages.map((message) =>
        message.role === 'assistant' ? (
          <AssistantMessage
            key={message.id}
            message={message}
            language={language}
            animateIn={!historyIds.current.has(message.id)}
            isLast={message.id === lastAssistantId}
            regenerating={regenerating}
            savedWords={savedWords}
            onSaveWord={onSaveWord}
            onRegenerate={onRegenerate}
            onSuggest={onSuggest}
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
            key={message.id}
            message={message}
            animateIn={!historyIds.current.has(message.id)}
            usedTargets={lemmasUsedIn(message.text, targetWords)}
          />
        ),
      )}

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
