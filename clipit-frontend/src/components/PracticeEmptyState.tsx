import React from 'react';

export type NavPage =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface PracticeEmptyStateProps {
  onNavigate: (page: NavPage) => void;
  title?: string;
  subtitle?: string;
  languageName?: string;
}

/**
 * Shared "you have no words to practice yet" state.
 * Used across all three practice modes (Flashcards, Voice Chat, Madlibs) so the
 * onboarding moment is consistent: upload your own list, or get the extension.
 */
export function PracticeEmptyState({
  onNavigate,
  title = 'Ready to start learning?',
  subtitle = 'Add some words to start practicing.',
  languageName,
}: PracticeEmptyStateProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-5 px-4">
      <div className="text-center">
        <p className="text-xl text-primary font-semibold mb-2">{title}</p>
        <p className="text-secondary text-sm max-w-sm">{subtitle}</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => onNavigate('vocabulary')}
          className="w-full px-6 py-3 bg-accent hover:bg-accent/90 text-app font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Upload Your Own List
        </button>
        <a
          href="https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full px-6 py-3 bg-surface border border-white/10 hover:border-white/20 text-primary font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          Get Clip It Extension
        </a>
      </div>

      <p className="text-muted text-xs text-center max-w-xs">
        Upload your own vocab list or use Clip It to learn from {languageName || 'target-language'} videos.
      </p>
    </div>
  );
}
