import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ClipDemo } from './ClipDemo';

const swift = [0.23, 1, 0.32, 1] as const;

interface HeroProps {
  onGetStarted: () => void;
}

export function Hero({ onGetStarted }: HeroProps) {
  return (
    <section id="top" className="mx-auto max-w-page px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: swift }}
          className="lg:col-span-5"
        >
          <h1 className="font-heading text-display text-primary md:text-display-lg">
            Clip it.
            <br />
            <span className="text-accent">Learn it.</span>
          </h1>
          <p className="mt-6 max-w-md text-lead font-light text-secondary">
            Learn a new language by watching <span className="whitespace-nowrap">Netflix &amp; YouTube.</span>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-7 py-4 text-lead font-medium text-[#fff] transition-colors duration-150 ease-swift hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start learning free
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="text-body text-muted">Free extension · no card needed</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: swift, delay: 0.06 }}
          className="lg:col-span-7"
        >
          <ClipDemo />
        </motion.div>
      </div>
    </section>
  );
}
