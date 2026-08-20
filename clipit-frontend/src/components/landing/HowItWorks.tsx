import React from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { loopStages } from '../../data/landing';
import { motionTiming } from '../../lib/motion';

const VLOG_FRAME =
  'https://cdn.magicpatterns.com/patterns/generated-images/78c36208-7c22-4434-b887-1069d99c4241.jpg';

function WatchVisual() {
  return (
    <div className="w-full overflow-hidden rounded-xl bg-ink">
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
        <div className="ml-1 h-2 flex-1 rounded-full bg-white/10" />
      </div>
      <div className="relative">
        <img src={VLOG_FRAME} alt="" className="h-[124px] w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-ink-deep/70 px-3 py-2.5">
          <div className="h-1.5 w-3/4 rounded-full bg-white/35" />
        </div>
      </div>
    </div>
  );
}

function CaptureVisual() {
  const rows = [
    { word: '단어', gloss: 'word', saved: true },
    { word: '배우다', gloss: 'to learn', saved: true },
    { word: '새롭다', gloss: 'to be new', saved: false },
  ];

  return (
    <div className="w-full rounded-xl bg-surface p-3">
      <p className="mb-2.5 flex items-center gap-1.5 text-meta font-semibold text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        ClipIt is listening
      </p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.word}
            className="flex items-center justify-between gap-3 rounded-lg bg-app px-2.5 py-2"
          >
            <span className="min-w-0">
              <span className="text-body-sm font-semibold text-primary">{row.word}</span>
              <span className="ml-2 truncate text-meta text-muted">{row.gloss}</span>
            </span>
            {row.saved ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Plus className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PracticeVisual() {
  return (
    <div className="w-full rounded-xl bg-surface p-3">
      <div className="rounded-lg bg-sand-soft px-3 py-6 text-center">
        <p className="text-card-title leading-none text-primary">배우다</p>
        <p className="mt-1.5 text-meta text-sand-ink">bae-u-da</p>
      </div>
      <div className="mt-2.5 flex gap-2">
        {['Again', 'Good', 'Easy'].map((label, i) => (
          <span
            key={label}
            className={`flex-1 whitespace-nowrap rounded-md py-1.5 text-center text-meta font-semibold ${
              i === 1 ? 'bg-accent text-[#fff]' : 'bg-app text-secondary'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

const visuals = [WatchVisual, CaptureVisual, PracticeVisual];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-blush py-16 md:py-24" aria-labelledby="how-it-works-title">
      <div className="mx-auto max-w-page px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2 id="how-it-works-title" className="font-heading text-section text-primary md:text-section-lg">
            One loop, from watching to remembering
          </h2>
          <p className="mt-4 text-lead text-secondary">
            You keep watching. ClipIt handles the part learners usually give up on: noticing new words
            and coming back to them at the right moment.
          </p>
        </div>

        <motion.ol
          className="mt-12 grid gap-6 md:grid-cols-3 md:gap-x-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }}
        >
          {loopStages.map((stage, index) => {
            const Visual = visuals[index];
            return (
              <motion.li
                key={stage.step}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0, transition: motionTiming.base },
                }}
                className="relative flex flex-col rounded-2xl bg-app p-5"
              >
                <div className="flex h-44 items-center">
                  <Visual />
                </div>

                <h3 className="mt-4 font-heading text-card-title text-primary">{stage.title}</h3>
                <p className="mt-2 text-body text-secondary">{stage.description}</p>

                {index < loopStages.length - 1 && (
                  <span
                    className="pointer-events-none absolute left-1/2 top-full z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-app text-accent md:left-auto md:right-[-46px] md:top-28 md:translate-x-0 md:translate-y-0"
                    aria-hidden="true"
                  >
                    <ChevronRight className="h-4 w-4 rotate-90 md:rotate-0" strokeWidth={2.5} />
                  </span>
                )}
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </section>
  );
}
