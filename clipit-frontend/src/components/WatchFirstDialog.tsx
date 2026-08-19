import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, X } from 'lucide-react';

const EXTENSION_URL = 'https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn';

interface WatchFirstDialogProps {
  modeLabel: string;
  language: string;
  onClose: () => void;
}

export function WatchFirstDialog({ modeLabel, language, onClose }: WatchFirstDialogProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <motion.div
        className="absolute inset-0 bg-inverse/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        onClick={onClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-first-title"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-subtle bg-app p-6 shadow-lg"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blush text-accent" aria-hidden="true">
          <Play className="h-5 w-5" />
        </span>

        <h2 id="watch-first-title" className="mt-4 font-heading text-card-title font-medium text-primary">
          {modeLabel} needs words first
        </h2>
        <p className="mt-2 text-body text-secondary">
          Watch something in {language} on YouTube or Netflix — the words come back here as cards.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
          >
            Open YouTube
          </a>
          <a
            href="https://www.netflix.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-subtle px-5 py-2.5 text-body-sm font-semibold text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
          >
            Open Netflix
          </a>
          <a
            href={EXTENSION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-muted underline decoration-transparent underline-offset-2 transition-colors duration-150 ease-swift hover:text-accent hover:decoration-accent/40"
          >
            Need the extension?
          </a>
        </div>
      </motion.div>
    </div>
  );
}
