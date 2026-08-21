import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { TrackedVideo } from './VideoHistoryItem';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface RemoveVideoDialogProps {
  video: TrackedVideo;
  isRemoving?: boolean;
  onCancel: () => void;
  onRemove: () => void;
}

export function RemoveVideoDialog({ video, isRemoving = false, onCancel, onRemove }: RemoveVideoDialogProps) {
  const dialogRef = useDialogFocus(true, () => {
    if (!isRemoving) onCancel();
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
        onClick={() => !isRemoving && onCancel()}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-video-title"
        aria-describedby="delete-video-description"
        tabIndex={-1}
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

        <h2 id="delete-video-title" className="pr-10 font-heading text-card-title font-medium text-primary">
          Delete video and flashcards?
        </h2>
        <p id="delete-video-description" className="mt-2 text-body text-secondary">
          <span className="font-semibold text-primary">{video.title}</span> will be removed from your watch history
          along with all flashcards made from its words.
        </p>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRemoving}
            className="w-full rounded-xl px-4 py-2.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isRemoving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-error px-4 py-2.5 text-body-sm font-semibold text-white transition-colors duration-150 ease-swift hover:bg-[#dc2626] disabled:opacity-70"
          >
            {isRemoving ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
