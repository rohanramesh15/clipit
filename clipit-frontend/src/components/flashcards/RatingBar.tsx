import React from 'react';
import { Check, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Rating } from '../../services/fsrs';
import { formatNextReview } from '../../utils/flashcardStorage';

interface PreviewTimes {
  again: Date;
  hard: Date;
  good: Date;
  easy: Date;
}

interface RatingBarProps {
  previewTimes: PreviewTimes | null;
  onRate: (rating: Rating) => void;
}

const ratings: { value: Rating; label: string; key: string; Icon: typeof X; previewKey: keyof PreviewTimes }[] = [
  { value: Rating.Again, label: 'Again', key: '1', Icon: X, previewKey: 'again' },
  { value: Rating.Hard, label: 'Hard', key: '2', Icon: ThumbsDown, previewKey: 'hard' },
  { value: Rating.Good, label: 'Good', key: '3', Icon: ThumbsUp, previewKey: 'good' },
  { value: Rating.Easy, label: 'Easy', key: '4', Icon: Check, previewKey: 'easy' },
];

export function RatingBar({ previewTimes, onRate }: RatingBarProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {ratings.map((rating) => {
        const isPrimary = rating.value === Rating.Good;
        const Icon = rating.Icon;
        return (
          <button
            key={rating.value}
            onClick={() => onRate(rating.value)}
            className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-colors duration-150 ease-swift ${
              isPrimary
                ? 'bg-sand-ink text-white hover:bg-sand-deep'
                : 'bg-sand-soft text-sand-deep hover:bg-sand-mid'
            }`}
          >
            <span
              className={`text-meta font-medium tabular-nums ${
                isPrimary ? 'text-white/75' : 'text-sand-ink'
              }`}
            >
              {previewTimes ? formatNextReview(previewTimes[rating.previewKey]) : ''}
            </span>
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="flex items-center gap-1.5 text-body-sm font-semibold">
              {rating.label}
              <span
                className={`rounded px-1 text-meta font-normal ${
                  isPrimary ? 'bg-white/25 text-white' : 'bg-white/70 text-sand-ink'
                }`}
              >
                {rating.key}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
