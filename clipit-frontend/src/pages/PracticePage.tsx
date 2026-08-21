import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PracticeModes } from '../components/PracticeModes';
import { WordQueue } from '../components/WordQueue';
import { StreakSummary } from '../components/StreakSummary';
import { PracticePageSkeleton } from '../components/PracticePageSkeleton';
import { getAnalyticsSummary } from '../services/fsrs';
import { homeQueueQueryOptions, RequestError } from '../lib/queries';

type Page =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface PracticePageProps {
  onNavigate: (page: Page) => void;
}

// A few varied greetings per time-of-day so it doesn't read the same every visit.
const GREETINGS: Record<string, string[]> = {
  night: ['Still up', 'Working late', 'Good evening'],
  morning: ['Good morning', 'Rise and shine', 'Morning'],
  afternoon: ['Good afternoon', 'Hello again', 'Hey'],
  evening: ['Good evening', 'Evening', 'Welcome back'],
};

function pickGreeting(): string {
  const h = new Date().getHours();
  const bucket = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const arr = GREETINGS[bucket];
  return arr[Math.floor(Math.random() * arr.length)];
}

export function PracticePage({ onNavigate }: PracticePageProps) {
  const { user, token } = useAuth();
  const { language, languageName } = useLanguage();
  const firstName = (user?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];

  const { streak, greeting } = useMemo(
    () => ({ streak: getAnalyticsSummary().streak, greeting: pickGreeting() }),
    [],
  );

  const wordQueue = useQuery({
    ...homeQueueQueryOptions(user?.id ?? 0, token ?? '', language),
    enabled: Boolean(user && token),
  });
  const queue = wordQueue.data ?? null;
  const words = queue?.words ?? null;
  const [isResyncingCaptions, setIsResyncingCaptions] = useState(false);
  // Cached practice data remains useful if a background refresh fails.
  const wordLoadState = words ? 'loaded' : wordQueue.isPending ? 'loading' : wordQueue.isError ? 'error' : 'loaded';

  const hasWatched = words !== null && words.length > 0;
  const dueCount = words ? words.filter((word) => word.status === 'due').length : 0;
  const resyncableVideoIds = (queue?.missingCaptionVideos || [])
    .filter((video) => video.platform === 'youtube')
    .map((video) => video.video_id);

  useEffect(() => {
    const finishResync = () => {
      setIsResyncingCaptions(false);
      void wordQueue.refetch();
    };
    const failResync = () => setIsResyncingCaptions(false);
    window.addEventListener('clipit:caption-resync-complete', finishResync);
    window.addEventListener('clipit:caption-resync-failed', failResync);
    return () => {
      window.removeEventListener('clipit:caption-resync-complete', finishResync);
      window.removeEventListener('clipit:caption-resync-failed', failResync);
    };
  }, [wordQueue.refetch]);

  const resyncCaptions = () => {
    if (resyncableVideoIds.length === 0) return;
    setIsResyncingCaptions(true);
    window.dispatchEvent(new CustomEvent('clipit:resync-captions', {
      detail: { videoIds: resyncableVideoIds, lang: language },
    }));
  };

  if (wordLoadState === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-label="Loading your practice queue">
        <PracticePageSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-10">
        <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">
          {wordLoadState === 'loaded' && hasWatched
            ? `${greeting}${firstName ? `, ${firstName}` : ''}.`
            : `Welcome${firstName ? `, ${firstName}` : ''}.`}
        </h1>

        {wordLoadState === 'loaded' && hasWatched && (
          <StreakSummary dueCount={dueCount} streakDays={streak} />
        )}
      </div>

      {wordLoadState === 'error' && (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-12 text-center">
          <AlertCircle className="h-7 w-7 text-accent" aria-hidden="true" />
          <div>
            <p className="font-semibold text-primary">
              {wordQueue.error instanceof RequestError && wordQueue.error.status === 401
                ? 'Your session has expired'
                : 'We couldn’t load your practice queue'}
            </p>
            <p className="mt-1 text-body-sm text-secondary">
              {wordQueue.error instanceof RequestError && wordQueue.error.status === 401
                ? 'Sign in again to continue practicing.'
                : 'Check your connection and try again.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void wordQueue.refetch()}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {wordLoadState === 'loaded' && words && (
        <>
          <PracticeModes onOpenMode={onNavigate} />
          <WordQueue
            words={words}
            languageName={languageName}
            sourceVideoCount={queue.sourceVideoCount}
            preparingVideoCount={queue.preparingVideoCount}
            unavailableVideoCount={queue.unavailableVideoCount}
            onRefresh={() => void wordQueue.refetch()}
            resyncableVideoCount={resyncableVideoIds.length}
            isResyncing={isResyncingCaptions}
            onResync={resyncCaptions}
          />
        </>
      )}
    </div>
  );
}
