import React from 'react';
import { motion } from 'framer-motion';
import { ExtensionInfo } from './ExtensionInfo';

// A short, real greeting in the language, used in the nudge message.
const LANGUAGE_PHRASES: Record<string, string> = {
  ko: '안녕',
  uk: 'привіт',
};

interface WatchNudgeProps {
  language: string;
  languageName: string;
}

export function WatchNudge({ language, languageName }: WatchNudgeProps) {
  const phrase = LANGUAGE_PHRASES[language] || '';

  return (
    <motion.div
      key={language}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      className="flex items-end gap-3"
    >
      <div className="flex items-start gap-1.5">
        <p className="max-w-[22rem] -rotate-[1.5deg] font-logo text-lead leading-snug text-accent">
          Go watch anything in {languageName}
          {phrase && (
            <span className="ml-1.5 whitespace-nowrap font-sans text-body-sm font-semibold text-muted">{phrase}</span>
          )}
          <br />
          and start practicing your words with these ways.
        </p>
        <ExtensionInfo languageName={languageName} />
      </div>

      <svg aria-hidden="true" viewBox="0 0 60 48" className="hidden h-12 w-[60px] shrink-0 text-accent/50 sm:block" fill="none">
        <path d="M4 4c14 2 26 9 30 22 2 6 1 11-1 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path
          d="M27 34c2 5 5 8 6 9 1-2 3-6 6-9"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  );
}
