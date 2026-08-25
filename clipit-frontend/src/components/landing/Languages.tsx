import React from 'react';
import { availableLanguages, type Language } from '../../data/landing';

function KoreanFlag() {
  const trigram = (x: number, y: number, rotate: number) => (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {[-2.6, 0, 2.6].map((offset) => (
        <rect key={offset} x={-4.5} y={offset - 0.6} width={9} height={1.2} fill="#0f0f0f" />
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 60 40" className="h-full w-full opacity-85 [filter:saturate(.85)]" role="img" aria-label="Flag of South Korea">
      <rect width="60" height="40" fill="#ffffff" />
      <circle cx="30" cy="20" r="10" fill="#CD2E3A" />
      <path d="M20 20 A5 5 0 0 0 30 20 A5 5 0 0 1 40 20 A10 10 0 0 1 20 20 Z" fill="#0047A0" />
      {trigram(11, 9, -33.7)}
      {trigram(49, 31, -33.7)}
      {trigram(49, 9, 33.7)}
      {trigram(11, 31, 33.7)}
    </svg>
  );
}

function UkrainianFlag() {
  return (
    <svg viewBox="0 0 60 40" className="h-full w-full opacity-85 [filter:saturate(.85)]" role="img" aria-label="Flag of Ukraine">
      <rect width="60" height="20" fill="#0057B7" />
      <rect y="20" width="60" height="20" fill="#FFD700" />
    </svg>
  );
}

const flags: Record<Language['id'], () => JSX.Element> = {
  korean: KoreanFlag,
  ukrainian: UkrainianFlag,
};

export function Languages() {
  return (
    <section className="bg-blush py-20 md:py-28" aria-labelledby="languages-title">
      <div className="mx-auto max-w-page px-5 sm:px-8">
        <div className="max-w-xl">
          <h2 id="languages-title" className="font-heading text-section text-primary md:text-section-lg">
            Two languages available
          </h2>
          <p className="mt-3 text-lead text-secondary">
            Clip from any video with subtitles in Korean or Ukrainian. Each language keeps its own deck,
            so you can learn both at once.
          </p>
        </div>

        <ul className="mt-12 grid gap-8 md:gap-10 md:grid-cols-2">
          {availableLanguages.map((language) => {
            const Flag = flags[language.id];
            return (
              <li key={language.id} className="relative">
                <span className="relative z-10 flex aspect-[3/2] w-full items-center justify-center overflow-hidden rounded-2xl border border-subtle bg-surface">
                  <span className="block h-3/5 w-3/5 overflow-hidden rounded-lg shadow-[0_8px_18px_-10px_rgba(56,35,35,0.35)]">
                    <Flag />
                  </span>
                </span>
                <p className="relative z-0 -mt-4 rounded-b-2xl bg-app px-6 pb-4 pt-8 text-center font-heading text-card-title font-medium leading-tight text-primary sm:px-7 sm:pb-5 sm:pt-9">
                  {language.english}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
