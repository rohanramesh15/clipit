import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { TrackedVideo } from './VideoHistoryItem';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Button } from './ui/button';

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
        <Button
          type="button"
          onClick={onCancel}
          disabled={isRemoving}
          variant="ghost"
          size="icon"
          aria-label="Close"
          className="absolute right-4 top-4 h-8 w-8 text-muted"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>

        <h2 id="delete-video-title" className="pr-10 font-heading text-card-title font-medium text-primary">
          Delete video and flashcards?
        </h2>
        <p id="delete-video-description" className="mt-2 text-body text-secondary">
          <span className="font-semibold text-primary">{video.title}</span> will be removed from your watch history
          along with all flashcards made from its words.
        </p>

        <div className="mt-6 space-y-2">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isRemoving}
            variant="ghost"
            className="w-full"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onRemove}
            disabled={isRemoving}
            variant="destructive"
            className="w-full"
          >
            {isRemoving ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
