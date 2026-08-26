import React from 'react';
import { motion } from 'framer-motion';
import { practiceModes } from '../../data/landing';
import { motionTiming } from '../../lib/motion';
import { FlashcardVisual, ChatVisual, MadlibsVisual } from '../PracticeModeVisuals';

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: motionTiming.base },
};

export function PracticeModes() {
  return (
    <section id="practice" className="py-16 md:py-24" aria-labelledby="practice-title">
      <div className="mx-auto max-w-page px-5 sm:px-8">
        <h2
          id="practice-title"
          className="font-heading text-section font-medium text-primary md:text-section-lg md:font-medium md:whitespace-nowrap"
        >
          Three ways to practice the words you clipped
        </h2>
        <p className="mt-4 max-w-2xl text-lead text-secondary">
          Review each word with flash cards, use it in an AI conversation, or complete a Mad Lib with it—whatever helps it stick.
        </p>

        <motion.div
          className="mt-12 grid items-stretch gap-6 md:grid-cols-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.article variants={cardVariants} className="flex h-full flex-col rounded-2xl bg-sand-soft p-7 sm:p-9">
            <h3 className="font-heading text-card-title text-sand-deep">
              {practiceModes.flashcards.title}
            </h3>
            <p className="mt-2 text-lead text-sand-ink">
              {practiceModes.flashcards.description}
            </p>
            <div className="mt-auto pt-8">
              <FlashcardVisual />
            </div>
          </motion.article>

          <motion.article variants={cardVariants} className="flex h-full flex-col rounded-2xl bg-sage-soft p-7 sm:p-9">
            <h3 className="font-heading text-card-title text-sage-deep">{practiceModes.voice.title}</h3>
            <p className="mt-2 text-lead text-sage-ink">{practiceModes.voice.description}</p>
            <div className="mt-auto pt-8">
              <ChatVisual />
            </div>
          </motion.article>

          <motion.article variants={cardVariants} className="flex h-full flex-col rounded-2xl bg-dusk-soft p-7 sm:p-9">
            <h3 className="font-heading text-card-title text-dusk-deep">{practiceModes.madlibs.title}</h3>
            <p className="mt-2 text-lead text-dusk-ink">{practiceModes.madlibs.description}</p>
            <div className="mt-auto pt-8">
              <MadlibsVisual />
            </div>
          </motion.article>
        </motion.div>
      </div>
    </section>
  );
}
