import React from 'react';
import { practiceModes } from '../../data/landing';

function FlashcardVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute inset-x-6 -top-3 h-full rounded-2xl bg-sand-mid/40" aria-hidden="true" />
      <div className="absolute inset-x-3 -top-1.5 h-full rounded-2xl bg-sand-mid/70" aria-hidden="true" />
      <div className="relative rounded-2xl bg-app p-6 text-center">
        <p className="text-display text-primary">단어</p>
        <p className="mt-2 text-body-sm text-sand-ink">dan-eo · word, vocabulary</p>
        <p className="mt-5 border-t border-subtle pt-4 text-meta leading-relaxed text-muted">
          “우리는 매일 새로운 <span className="font-semibold text-secondary">단어를</span> 배워요”
        </p>
      </div>
    </div>
  );
}

function VoiceVisual() {
  const bars = [8, 16, 26, 14, 22, 10, 18, 28, 12, 20, 9, 15];
  return (
    <div className="flex items-end gap-1.5" aria-hidden="true">
      {bars.map((height, i) => (
        <span key={i} className="w-1.5 rounded-full bg-sage-mid" style={{ height: `${height}px` }} />
      ))}
    </div>
  );
}

function MadlibsVisual() {
  return (
    <p className="text-body leading-7 text-secondary" aria-hidden="true">
      우리는 매일{' '}
      <span className="rounded bg-dusk-soft px-2 py-0.5 font-semibold text-dusk-ink">새로운</span>{' '}
      <span className="inline-block h-4 w-14 rounded border-b-2 border-dashed border-dusk-mid align-middle" />{' '}
      배워요
    </p>
  );
}

export function PracticeModes() {
  return (
    <section id="practice" className="py-16 md:py-24" aria-labelledby="practice-title">
      <div className="mx-auto max-w-page px-5 sm:px-8">
        <h2
          id="practice-title"
          className="font-heading text-section text-primary md:text-section-lg md:whitespace-nowrap"
        >
          Three ways to practice the words you clipped
        </h2>

        <div className="mt-12 grid gap-6 lg:grid-cols-5">
          <article className="flex flex-col justify-between rounded-2xl bg-sand-soft p-7 sm:p-9 lg:col-span-3">
            <div>
              <h3 className="font-heading text-card-title text-sand-deep">
                {practiceModes.flashcards.title}
              </h3>
              <p className="mt-2 max-w-sm text-lead text-sand-ink">
                {practiceModes.flashcards.description}
              </p>
            </div>
            <div className="pt-8">
              <FlashcardVisual />
            </div>
          </article>

          <div className="grid gap-6 lg:col-span-2">
            <article className="flex flex-col rounded-2xl bg-sage-soft p-7">
              <h3 className="font-heading text-card-title text-sage-deep">{practiceModes.voice.title}</h3>
              <p className="mt-2 text-lead text-sage-ink">{practiceModes.voice.description}</p>
              <div className="mt-auto pt-6">
                <VoiceVisual />
              </div>
            </article>

            <article className="flex flex-col rounded-2xl bg-dusk-soft p-7">
              <h3 className="font-heading text-card-title text-dusk-deep">{practiceModes.madlibs.title}</h3>
              <p className="mt-2 text-lead text-dusk-ink">{practiceModes.madlibs.description}</p>
              <div className="mt-auto pt-6">
                <MadlibsVisual />
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
