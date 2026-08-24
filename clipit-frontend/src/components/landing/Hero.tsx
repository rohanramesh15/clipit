import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import landingPage from '../../assets/landing_page.png';
import { motionEase, motionTiming } from '../../lib/motion';
import { Button } from '../ui/button';

const heroSequence = {
  hidden: {},
  visible: { transition: { delayChildren: 0.08, staggerChildren: 0.07 } },
};

const heroItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: motionTiming.page },
};

interface HeroProps {
  onGetStarted: () => void;
}

export function Hero({ onGetStarted }: HeroProps) {
  return (
    <motion.section
      id="top"
      variants={heroSequence}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-page px-5 pb-16 pt-14 sm:px-8 md:pb-24 md:pt-20"
    >
      <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <motion.h1 variants={heroItem} className="font-heading text-display text-primary md:text-display-lg">
            Clip it.
            <br />
            <span className="text-accent">Learn it.</span>
          </motion.h1>
          <motion.p variants={heroItem} className="mt-6 max-w-md text-lead font-light text-secondary">
            Learn a new language by watching <span className="whitespace-nowrap">Netflix &amp; YouTube.</span>
          </motion.p>

          <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button
              type="button"
              onClick={onGetStarted}
              size="lg"
              className="h-auto px-7 py-4 text-lead font-medium"
            >
              Start learning free
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Button>
            <p className="text-body text-muted">Free extension · no card needed</p>
          </motion.div>
        </div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 16 },
            visible: { opacity: 1, y: 0, transition: { ...motionTiming.page, delay: 0.1, ease: motionEase } },
          }}
          className="lg:col-span-7 lg:mr-2.5"
        >
          <div
            className="rounded-2xl border-[5px] border-sand-soft"
            style={{ boxShadow: '0 0 0 5px #ecf2ea, 0 0 0 10px #edf0f8' }}
          >
            <img
              src={landingPage}
              alt="ClipIt tracking a YouTube video in the browser"
              className="w-full rounded-xl"
            />
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
