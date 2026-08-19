import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Scissors, GalleryVerticalEnd } from 'lucide-react';

const EXTENSION_URL = 'https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn';

const STEPS = [
  { step: '01', label: 'Watch anything', Icon: Play },
  { step: '02', label: 'Words get clipped', Icon: Scissors },
  { step: '03', label: 'Practice back here', Icon: GalleryVerticalEnd },
];

interface GetStartedPanelProps {
  firstName: string;
  onUploadList: () => void;
}

export function GetStartedPanel({ firstName, onUploadList }: GetStartedPanelProps) {
  return (
    <motion.section
      aria-labelledby="get-started-heading"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl bg-blush p-8 sm:p-10"
    >
      <h2 id="get-started-heading" className="font-heading text-section text-primary">
        Watch. Clip. Remember.
      </h2>
      <p className="mt-2 text-lead text-secondary">Your deck writes itself, {firstName}.</p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href="https://www.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-body font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          Open YouTube
          <ArrowRight className="h-5 w-5 transition-transform duration-150 ease-swift group-hover:translate-x-1" aria-hidden="true" />
        </a>
        <a
          href="https://www.netflix.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-xl border border-medium px-6 py-3 text-body font-semibold text-secondary transition-colors duration-150 ease-swift hover:bg-app hover:text-primary"
        >
          Open Netflix
        </a>
        <button
          type="button"
          onClick={onUploadList}
          className="inline-flex items-center rounded-xl border border-medium px-6 py-3 text-body font-semibold text-secondary transition-colors duration-150 ease-swift hover:bg-app hover:text-primary"
        >
          Upload your own list
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-medium pt-6">
        <ol className="flex flex-wrap gap-x-6 gap-y-3">
          {STEPS.map((step) => (
            <li key={step.step} className="flex items-center gap-2 text-body-sm font-medium text-secondary">
              <step.Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {step.label}
            </li>
          ))}
        </ol>
        <a
          href={EXTENSION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-body-sm text-muted underline decoration-transparent underline-offset-2 transition-colors duration-150 ease-swift hover:text-accent hover:decoration-accent/40"
        >
          Need the extension?
        </a>
      </div>
    </motion.section>
  );
}
