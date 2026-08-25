import React from 'react';
import { Volume2 } from 'lucide-react';
import { speak } from '../../utils/speech';

interface PronounceButtonProps {
  text: string;
  language: string;
  label: string;
  size?: 'sm' | 'md';
  /** "plain" drops the circular border/fill for use next to text that already reads as the control's context. */
  variant?: 'default' | 'plain';
}

export function PronounceButton({ text, language, label, size = 'md', variant = 'default' }: PronounceButtonProps) {
  // Both sizes meet the 44px minimum touch target; "sm" stays visually lighter via a smaller icon, not a smaller tap area.
  const dimensions = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const chrome =
    variant === 'plain'
      ? 'text-muted hover:text-accent'
      : 'rounded-full border border-subtle bg-app text-primary hover:bg-blush';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        speak(text, language);
      }}
      className={`${dimensions} flex shrink-0 items-center justify-center transition-colors duration-150 ease-swift ${chrome}`}
    >
      <Volume2 className={icon} aria-hidden="true" />
    </button>
  );
}
