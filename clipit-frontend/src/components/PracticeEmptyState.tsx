interface PracticeEmptyStateProps {
  mode: string;
}

/**
 * Shared no-video state for practice modes. It matches Flashcards' onboarding
 * path: install the extension, then watch a video to create practice material.
 */
export function PracticeEmptyState({ mode }: PracticeEmptyStateProps) {
  return (
    <div className="mt-10 flex flex-col items-center gap-5 py-12 text-center">
      <div className="text-center">
        <p className="text-body font-semibold text-primary">You haven't watched any videos yet.</p>
        <p className="mt-2 max-w-sm text-body-sm text-secondary">
          Install the ClipIt extension, then watch something on YouTube or Netflix. We'll use the words you hear in {mode}.
        </p>
      </div>

      <a
        href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-accent px-6 py-3 text-body-sm font-semibold text-on-accent hover:bg-accent-hover"
      >
        Get ClipIt extension
      </a>
    </div>
  );
}
