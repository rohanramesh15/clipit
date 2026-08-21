import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';
import type { TrackedVideo } from './VideoHistoryItem';

interface RemoveVideoDialogProps {
  video: TrackedVideo;
  isRemoving?: boolean;
  onCancel: () => void;
  onRemove: (alsoFlashcards: boolean) => void;
}

export function RemoveVideoDialog({ video, isRemoving = false, onCancel, onRemove }: RemoveVideoDialogProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isRemoving) onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel, isRemoving]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <motion.div
        className="absolute inset-0 bg-black/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        onClick={() => !isRemoving && onCancel()}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-title"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-subtle bg-app p-6 shadow-lg"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isRemoving}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-blush text-accent" aria-hidden="true">
          <Trash2 className="h-5 w-5" />
        </span>

        <h2 id="remove-title" className="mt-4 font-heading text-card-title text-primary">
          Remove from history?
        </h2>
        <p className="mt-2 text-body text-secondary">
          <span className="font-semibold text-primary">{video.title}</span> will leave your history. Choose whether to
          also delete the flashcards made from its words.
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => onRemove(false)}
            disabled={isRemoving}
            className="w-full rounded-xl bg-accent px-4 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover disabled:opacity-70"
          >
            {isRemoving ? 'Removing…' : 'Remove video only'}
          </button>
          <button
            type="button"
            onClick={() => onRemove(true)}
            disabled={isRemoving}
            className="w-full rounded-xl border border-medium px-4 py-2.5 text-body-sm font-semibold text-error transition-colors duration-150 ease-swift hover:bg-error/10 disabled:opacity-70"
          >
            {isRemoving ? 'Removing…' : 'Remove video & flashcards'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isRemoving}
            className="w-full rounded-xl px-4 py-2.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
