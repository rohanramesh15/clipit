import React from 'react';
import { motion } from 'framer-motion';
import { FlashcardVisual, ChatVisual, MadlibsVisual } from './PracticeModeVisuals';
import { NavigationIcon } from './NavigationIconButton';
import { motionTiming } from '../lib/motion';

export type ModeId = 'flashcards' | 'converse-v2' | 'madlibs';

interface ModeDef {
  id: ModeId;
  label: string;
  description: string;
  Visual: React.ComponentType;
  surface: string;
  heading: string;
  body: string;
}

const MODES: ModeDef[] = [
  {
    id: 'flashcards',
    label: 'Flash cards',
    description: 'Spaced-repetition review, scheduled for the moment you’re about to forget.',
    Visual: FlashcardVisual,
    surface: 'bg-sand-soft',
    heading: 'text-sand-deep',
    body: 'text-sand-ink',
  },
  {
    id: 'converse-v2',
    label: 'AI chat',
    description: 'Talk with a tutor that weaves your due words into real conversation.',
    Visual: ChatVisual,
    surface: 'bg-sage-soft',
    heading: 'text-sage-deep',
    body: 'text-sage-ink',
  },
  {
    id: 'madlibs',
    label: 'Mad libs',
    description: 'Drop your words back into the sentences from the videos you watched.',
    Visual: MadlibsVisual,
    surface: 'bg-dusk-soft',
    heading: 'text-dusk-deep',
    body: 'text-dusk-ink',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: motionTiming.base },
};

interface PracticeModesProps {
  onOpenMode: (id: ModeId) => void;
}

export function PracticeModes({ onOpenMode }: PracticeModesProps) {
  return (
    <section aria-labelledby="practice-heading">
      <h2 id="practice-heading" className="sr-only">
        Ways to practice
      </h2>

      <motion.div
        className="grid items-stretch gap-6 md:grid-cols-3"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {MODES.map((mode) => (
          <motion.button
            key={mode.id}
            type="button"
            onClick={() => onOpenMode(mode.id)}
            variants={cardVariants}
            whileHover={{ y: -2 }}
            className={`group flex h-full flex-col rounded-2xl px-7 py-8 text-left transition-shadow duration-150 ease-swift hover:shadow-[0_8px_24px_rgba(76,35,35,0.08)] ${mode.surface}`}
          >
            <div className="flex items-center gap-3">
              <h3 className={`font-heading text-card-title font-medium ${mode.heading}`}>{mode.label}</h3>
              <span className={`ml-auto inline-flex shrink-0 items-center rounded-xl p-2 transition-transform duration-150 ease-swift group-hover:translate-x-1 ${mode.heading}`} aria-hidden="true">
                <NavigationIcon direction="forward" />
              </span>
            </div>

            <p className={`mt-3 min-h-[5rem] text-body ${mode.body}`}>{mode.description}</p>

            <div className="mt-4">
              <mode.Visual />
            </div>
          </motion.button>
        ))}
      </motion.div>
    </section>
  );
}
