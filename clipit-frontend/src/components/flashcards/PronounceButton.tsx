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
  const dimensions = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        speak(text, language);
      }}
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full bg-sand-soft text-sand-deep transition-colors duration-150 ease-swift hover:bg-sand-mid`}
    >
      <Volume2 className={icon} aria-hidden="true" />
    </button>
  );
}
