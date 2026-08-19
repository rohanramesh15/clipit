import React from 'react';
import { practiceModes } from '../../data/landing';
import { FlashcardVisual, ChatVisual, MadlibsVisual } from '../PracticeModeVisuals';

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
                <ChatVisual />
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
