import React from 'react';
import { Rating } from '../../services/fsrs';
import { formatNextReview } from '../../utils/flashcardStorage';
import { Button } from '../ui/button';

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
      {ratings.map((rating) => (
        <Button
          key={rating.value}
          onClick={() => onRate(rating.value)}
          variant="secondary"
          className="h-auto flex-col gap-1 bg-surface-hover px-2 py-3 hover:bg-accent-soft"
        >
          <span>{rating.label}</span>
          <span className="text-meta font-normal text-muted">
            {previewTimes ? formatNextReview(previewTimes[rating.previewKey]) : ''}
          </span>
        </Button>
      ))}
    </div>
  );
}
