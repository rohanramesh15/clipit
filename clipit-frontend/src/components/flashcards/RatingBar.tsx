import React from 'react';
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

const ratings: { value: Rating; label: string; previewKey: keyof PreviewTimes }[] = [
  { value: Rating.Again, label: 'Again', previewKey: 'again' },
  { value: Rating.Hard, label: 'Hard', previewKey: 'hard' },
  { value: Rating.Good, label: 'Good', previewKey: 'good' },
  { value: Rating.Easy, label: 'Easy', previewKey: 'easy' },
];

export function RatingBar({ previewTimes, onRate }: RatingBarProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ratings.map((rating) => {
        const isPrimary = rating.value === Rating.Good;
        return (
          <button
            key={rating.value}
            onClick={() => onRate(rating.value)}
            className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-body-sm font-semibold transition-colors duration-150 ease-swift ${
              isPrimary
                ? 'bg-accent text-on-accent hover:bg-accent-hover'
                : 'bg-surface-hover text-primary hover:bg-blush'
            }`}
          >
            <span>{rating.label}</span>
            <span className={`text-meta font-normal ${isPrimary ? 'text-on-accent/75' : 'text-muted'}`}>
              {previewTimes ? formatNextReview(previewTimes[rating.previewKey]) : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
