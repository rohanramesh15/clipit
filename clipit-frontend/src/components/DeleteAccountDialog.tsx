import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X } from 'lucide-react';

const ERASED_ITEMS = [
  'Vocabulary lists and saved words',
  'Flashcard progress and review history',
  'Watched videos and mined words',
  'Deck and learning preferences',
];

interface DeleteAccountDialogProps {
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteAccountDialog({ isDeleting, error, onCancel, onConfirm }: DeleteAccountDialogProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel, isDeleting]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <motion.div
        className="absolute inset-0 bg-inverse/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        onClick={() => !isDeleting && onCancel()}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-subtle bg-app p-6 shadow-lg"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-error/10 text-error" aria-hidden="true">
          <Trash2 className="h-5 w-5" />
        </span>

        <h2 id="delete-account-title" className="mt-4 font-heading text-card-title font-medium text-primary">
          Delete your account?
        </h2>
        <p id="delete-account-description" className="mt-2 text-body text-secondary">
          This <span className="font-semibold text-primary">cannot be undone</span>. Everything tied to your account is
          erased permanently, including:
        </p>
        <ul className="mt-3 space-y-1.5 text-body-sm text-secondary">
          {ERASED_ITEMS.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        {error && (
          <div className="mt-4 rounded-lg border border-error/20 bg-error/10 px-3 py-2.5 text-body-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full rounded-xl bg-error px-4 py-2.5 text-body-sm font-semibold text-white transition-colors duration-150 ease-swift hover:bg-error/90 disabled:opacity-70"
          >
            {isDeleting ? 'Deleting…' : 'Delete account permanently'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="w-full rounded-xl px-4 py-2.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
