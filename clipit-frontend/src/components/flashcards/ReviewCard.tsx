import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Pencil, RotateCw } from 'lucide-react';
import { FlashCard } from '../../types/flashcards';
import { getWordFontSize } from '../../utils/flashcardStorage';
import { ClipPlayer } from './ClipPlayer';
import { PronounceButton } from './PronounceButton';

interface CardStats {
  isNew: boolean;
  repetitions: number;
}

interface ReviewCardProps {
  card: FlashCard;
  stats: CardStats | null;
  language: string;
  isFlipped: boolean;
  onFlip: () => void;
  playerContainerRef: React.RefObject<HTMLDivElement>;
  onRevertToTTS: () => void;
  isReverting: boolean;
  onDeleteCard: () => void;
  isEditingDefinition: boolean;
  editedDefinition: string;
  onStartEdit: () => void;
  onChangeEditedDefinition: (value: string) => void;
  onSaveDefinition: () => void;
  onCancelEdit: () => void;
}

const faceClasses =
  'absolute inset-0 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-subtle bg-surface p-5 shadow-sm [backface-visibility:hidden]';

export function ReviewCard({
  card,
  stats,
  language,
  isFlipped,
  onFlip,
  playerContainerRef,
  onRevertToTTS,
  isReverting,
  onDeleteCard,
  isEditingDefinition,
  editedDefinition,
  onStartEdit,
  onChangeEditedDefinition,
  onSaveDefinition,
  onCancelEdit,
}: ReviewCardProps) {
  const timeStr =
    card.timestamp != null
      ? `${Math.floor(card.timestamp / 60)}:${String(Math.floor(card.timestamp % 60)).padStart(2, '0')}`
      : null;

  return (
    <div className="mx-auto w-full max-w-[22rem] [perspective:1600px]">
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="relative h-[26rem] w-full [transform-style:preserve-3d]"
      >
        {/* Front — the clip and the word */}
        <div
          className={faceClasses}
          aria-hidden={isFlipped}
          onClick={isFlipped ? undefined : onFlip}
        >
          <div className="flex shrink-0 items-center justify-between">
            {stats?.isNew === false ? (
              <span className="flex items-center gap-1 rounded-full border border-subtle px-2.5 py-1 text-meta font-semibold text-secondary">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {stats.repetitions}x
              </span>
            ) : (
              <span className="rounded-full bg-blush px-2.5 py-1 text-meta font-semibold text-accent">
                New word
              </span>
            )}
            {timeStr && <span className="text-meta tabular-nums text-muted">{timeStr}</span>}
          </div>

          <div className="mt-3 shrink-0" onClick={(event) => event.stopPropagation()}>
            <ClipPlayer
              card={card}
              language={language}
              playerContainerRef={playerContainerRef}
              isRevealed={isFlipped}
              onRevertToTTS={onRevertToTTS}
              isReverting={isReverting}
              onDeleteCard={onDeleteCard}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 py-3 text-center">
            <h2 className={`${getWordFontSize(card.target_word)} font-heading leading-tight text-primary`}>
              {card.target_word}
            </h2>
            {/* TTS-only cards already have a dedicated pronunciation control via ClipPlayer's placeholder above. */}
            {card.card_type === 'video' && (
              <div className="mt-2" onClick={(event) => event.stopPropagation()}>
                <PronounceButton
                  text={card.target_word}
                  language={language}
                  label={`Hear ${card.target_word} pronounced`}
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFlip();
            }}
            className="flex shrink-0 items-center justify-center gap-1.5 border-t border-subtle pt-3 text-meta text-muted"
            aria-label="Show the definition"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Show definition
          </button>
        </div>

        {/* Back — the meaning */}
        <div
          className={`${faceClasses} [transform:rotateY(180deg)]`}
          aria-hidden={!isFlipped}
          onClick={isFlipped ? onFlip : undefined}
        >
          <div className="flex shrink-0 items-center justify-between gap-3">
            <span className="truncate rounded-full bg-blush px-2.5 py-1 text-meta font-semibold text-accent">
              {card.target_word}
            </span>
            <div className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
              <PronounceButton
                text={card.target_word}
                language={language}
                label={`Hear ${card.target_word} pronounced`}
                size="sm"
              />
              {!isEditingDefinition && (
                <button
                  onClick={onStartEdit}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover text-primary transition-colors hover:bg-blush"
                  title="Edit definition"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center">
            {isEditingDefinition ? (
              <div className="w-full" onClick={(event) => event.stopPropagation()}>
                <input
                  type="text"
                  value={editedDefinition}
                  onChange={(event) => onChangeEditedDefinition(event.target.value)}
                  className="w-full rounded-lg border border-medium bg-app px-4 py-3 text-center text-lead text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSaveDefinition();
                    if (event.key === 'Escape') onCancelEdit();
                  }}
                />
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={onCancelEdit}
                    className="rounded-lg border border-subtle bg-app px-4 py-1.5 text-body-sm font-medium text-primary hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSaveDefinition}
                    className="rounded-lg bg-accent px-4 py-1.5 text-body-sm font-medium text-on-accent hover:bg-accent-hover"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-heading text-[1.75rem] leading-tight text-primary">
                {card.english && card.english !== 'definition not available' ? card.english : '-'}
              </p>
            )}
            {card.dictionary_form && card.dictionary_form !== card.target_word && (
              <p className="mt-2 text-body-sm text-secondary">Dictionary form · {card.dictionary_form}</p>
            )}

            {card.sentence && (
              <div className="mt-6 border-t border-subtle pt-5">
                <p className="text-body text-primary">
                  {card.sentence.split(new RegExp(`(${card.target_word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')).map((part, i) =>
                    part === card.target_word ? (
                      <mark key={i} className="bg-transparent font-semibold text-accent">
                        {part}
                      </mark>
                    ) : (
                      <React.Fragment key={i}>{part}</React.Fragment>
                    ),
                  )}
                </p>
                {card.sentence_translation && card.sentence_translation !== 'No translation available' && (
                  <p className="mt-2 text-body-sm text-secondary">{card.sentence_translation}</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFlip();
            }}
            className="shrink-0 text-center text-meta text-muted"
            aria-label="Show the prompt"
          >
            Show prompt
          </button>
        </div>
      </motion.div>
    </div>
  );
}
