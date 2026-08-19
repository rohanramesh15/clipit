import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { demoLine, demoLineTranslation } from '../../data/landing';

const HERO_FRAME =
  'https://cdn.magicpatterns.com/patterns/generated-images/8e58cf16-1661-4d93-b19e-7ef0ba779ca4.jpg';
const swift = [0.23, 1, 0.32, 1] as const;

export function ClipDemo() {
  const [clipped, setClipped] = useState<string[]>([]);
  const clip = (surface: string) => {
    setClipped((prev) => (prev.includes(surface) ? prev : [...prev, surface]));
  };

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl bg-ink shadow-[0_24px_60px_-30px_rgba(76,35,35,0.55)]">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <div className="ml-2 flex-1 truncate rounded-md bg-white/[0.06] px-3 py-1 text-[11px] text-white/45">
            netflix.com/watch/81032478
          </div>
          <span className="flex h-5 items-center gap-1 rounded bg-accent/20 px-1.5 text-[10px] font-bold text-cream">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            ClipIt
          </span>
        </div>

        <div className="relative">
          <img
            src={HERO_FRAME}
            alt="A scene from a Korean drama playing in the browser"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-ink-deep/75" aria-hidden="true" />

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
            <p className="mb-2 text-[11px] font-semibold text-cream/70">Tap a word to clip it</p>
            <ul className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {demoLine.map((word) => {
                const isClipped = clipped.includes(word.surface);
                return (
                  <li key={word.surface}>
                    <motion.button
                      type="button"
                      onClick={() => clip(word.surface)}
                      aria-pressed={isClipped}
                      initial={false}
                      animate={isClipped ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.22, ease: swift }}
                      className={`group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-heading text-xl font-semibold transition-colors duration-150 ease-swift sm:text-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream ${
                        isClipped ? 'bg-cream text-ink-deep' : 'text-[#fff] hover:bg-white/12'
                      }`}
                    >
                      {word.surface}
                      {!isClipped && (
                        <Plus
                          className="h-3.5 w-3.5 text-cream/0 transition-colors duration-150 ease-swift group-hover:text-cream"
                          aria-hidden="true"
                        />
                      )}
                    </motion.button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-sm text-white/55">{demoLineTranslation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
