import { Film } from 'lucide-react';

interface PracticeEmptyStateProps {
  mode: string;
}

/**
 * Shared no-video state for every practice-mode dashboard. A single component
 * keeps Flashcards, AI chat, and Mad Libs visually and behaviorally aligned.
 */
export function PracticeEmptyState({ mode }: PracticeEmptyStateProps) {
  return (
    <section className="mt-10 flex flex-col items-center rounded-2xl bg-surface px-6 py-12 text-center" aria-label={`No videos available for ${mode}`}>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover text-accent" aria-hidden="true">
        <Film className="h-6 w-6" />
      </span>
      <h2 className="mt-5 font-heading text-card-title text-primary">You haven&apos;t watched any videos yet</h2>
      <p className="mt-2 max-w-sm text-body-sm text-secondary">
        Install the ClipIt extension, then watch something on YouTube or Netflix. We&apos;ll use the words you hear in {mode}.
      </p>

      <a
        href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 inline-flex items-center rounded-xl bg-accent px-6 py-3 text-body-sm font-semibold text-on-accent hover:bg-accent-hover"
      >
        Get ClipIt extension
      </a>
    </section>
  );
}
