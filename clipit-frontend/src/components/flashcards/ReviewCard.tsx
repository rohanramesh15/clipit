import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Pencil, RotateCw, Volume2 } from 'lucide-react';
import { FlashCard } from '../../types/flashcards';
import { getWordFontSize } from '../../utils/flashcardStorage';
import { ClipPlayer } from './ClipPlayer';

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
  onPlaySentenceTTS: (sentence: string) => void;
}

const faceClasses =
  'absolute inset-0 flex flex-col rounded-2xl border border-sand-mid/60 bg-sand-tint p-5 [backface-visibility:hidden]';

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
  onPlaySentenceTTS,
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
        className="relative h-[34rem] w-full [transform-style:preserve-3d]"
      >
        {/* Front — the clip and the word */}
        <div
          className={faceClasses}
          aria-hidden={isFlipped}
          onClick={isFlipped ? undefined : onFlip}
          role="button"
          tabIndex={isFlipped ? -1 : 0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onFlip();
          }}
        >
          <div className="flex items-center justify-between">
            {stats?.isNew === false ? (
              <span className="flex items-center gap-1 rounded-full border border-sand-ink/20 px-2.5 py-1 text-meta font-semibold text-sand-ink">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {stats.repetitions}x
              </span>
            ) : (
              <span className="rounded-full bg-sand-soft px-2.5 py-1 text-meta font-semibold text-sand-deep">
                New word
              </span>
            )}
            {timeStr && <span className="text-meta tabular-nums text-sand-ink">{timeStr}</span>}
          </div>

          <div className="mt-4" onClick={(event) => event.stopPropagation()}>
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

          <div className="flex flex-1 flex-col items-center justify-center px-2 text-center">
            <h2 className={`${getWordFontSize(card.target_word)} font-heading leading-tight text-sand-deep`}>
              {card.target_word}
            </h2>
            {card.dictionary_form && card.dictionary_form !== card.target_word && (
              <p className="mt-1.5 text-meta text-sand-ink">({card.dictionary_form})</p>
            )}
          </div>

          <p className="flex items-center justify-center gap-1.5 border-t border-sand-mid/60 pt-4 text-meta text-sand-ink">
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Tap the card to flip
          </p>
        </div>

        {/* Back — the meaning */}
        <div
          className={`${faceClasses} [transform:rotateY(180deg)]`}
          aria-hidden={!isFlipped}
          onClick={isFlipped ? onFlip : undefined}
          role="button"
          tabIndex={isFlipped ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onFlip();
          }}
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-sand-soft px-2.5 py-1 text-meta font-semibold text-sand-deep">
              Meaning
            </span>
            {!isEditingDefinition && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onStartEdit();
                }}
                className="rounded-lg p-1.5 text-sand-ink transition-colors hover:bg-white/60 hover:text-sand-deep"
                title="Edit definition"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-1 flex-col justify-center">
            {isEditingDefinition ? (
              <div className="w-full" onClick={(event) => event.stopPropagation()}>
                <input
                  type="text"
                  value={editedDefinition}
                  onChange={(event) => onChangeEditedDefinition(event.target.value)}
                  className="w-full rounded-lg border border-sand-mid bg-white px-4 py-3 text-center text-lead text-sand-deep focus:outline-none focus:ring-2 focus:ring-sand-ink/40"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSaveDefinition();
                    if (event.key === 'Escape') onCancelEdit();
                  }}
                />
                <div className="mt-3 flex justify-center gap-2">
                  <button
                    onClick={onCancelEdit}
                    className="rounded-lg bg-white/70 px-4 py-1.5 text-body-sm font-medium text-sand-deep hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSaveDefinition}
                    className="rounded-lg bg-sand-ink px-4 py-1.5 text-body-sm font-medium text-white hover:bg-sand-deep"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className={`${getWordFontSize(card.english || '-')} font-heading leading-snug text-sand-deep text-center`}>
                {card.english && card.english !== 'definition not available' ? card.english : '-'}
              </p>
            )}
            <p className="mt-2 text-center text-body-sm italic text-sand-ink">{card.target_word}</p>

            {card.card_type === 'tts' && card.sentence && (
              <div className="mt-6 rounded-xl bg-sand-soft p-4">
                <div className="mb-2 flex items-center justify-center gap-2">
                  <p className="text-meta uppercase tracking-wide text-sand-ink">Example</p>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      if (card.sentence) onPlaySentenceTTS(card.sentence);
                    }}
                    className="rounded-full bg-white/70 p-1.5 text-sand-deep transition-colors hover:bg-sand-ink hover:text-[#ffffff]"
                    title="Listen to example"
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-center text-body text-sand-deep">{card.sentence}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
