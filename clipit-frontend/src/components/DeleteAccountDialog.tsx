import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Button } from './ui/button';

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
  const dialogRef = useDialogFocus(true, () => {
    if (!isDeleting) onCancel();
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-black/35"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
        onClick={() => !isDeleting && onCancel()}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        tabIndex={-1}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md rounded-2xl border border-subtle bg-app p-6 shadow-lg"
      >
        <Button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          variant="ghost"
          size="icon"
          aria-label="Close"
          className="absolute right-4 top-4 h-8 w-8 text-muted"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>

        <h2 id="delete-account-title" className="pr-10 font-heading text-card-title font-medium text-primary">
          Delete your account?
        </h2>
        <p id="delete-account-description" className="mt-2 text-body text-secondary">
          <span className="whitespace-nowrap">This <span className="font-semibold text-primary">can't be undone</span>.</span> Everything tied to your account is
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
          <div role="alert" className="mt-4 rounded-lg border border-error/20 bg-error/10 px-3 py-2.5 text-body-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-6 space-y-2">
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            variant="destructive"
            className="w-full"
          >
            {isDeleting ? 'Deleting…' : 'Delete account permanently'}
          </Button>
          <Button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            variant="ghost"
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
