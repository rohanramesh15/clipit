import React from 'react';
import { Volume2 } from 'lucide-react';
import { speak } from '../../utils/speech';

interface PronounceButtonProps {
  text: string;
  language: string;
  label: string;
  size?: 'sm' | 'md';
}

export function PronounceButton({ text, language, label, size = 'md' }: PronounceButtonProps) {
  // Both sizes meet the 44px minimum touch target; "sm" stays visually lighter via a smaller icon, not a smaller tap area.
  const dimensions = size === 'sm' ? 'h-11 w-11' : 'h-12 w-12';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        speak(text, language);
      }}
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full bg-surface-hover text-primary transition-colors duration-150 ease-swift hover:bg-blush`}
    >
      <Volume2 className={icon} aria-hidden="true" />
    </button>
  );
}
