import { useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PracticeModes } from '../components/PracticeModes';
import { WordQueue } from '../components/WordQueue';
import { StreakSummary } from '../components/StreakSummary';
import { WatchNudge } from '../components/WatchNudge';
import { Skeleton } from '../components/Skeleton';
import { getAnalyticsSummary } from '../services/fsrs';
import { homeQueueQueryOptions } from '../lib/queries';
import { queryClient } from '../lib/queryClient';

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
    ...homeQueueQueryOptions(queryClient, user?.id ?? 0, token ?? '', language),
    enabled: Boolean(user && token),
  });
  const words = wordQueue.data ?? null;
  const wordLoadState = wordQueue.isPending ? 'loading' : wordQueue.isError ? 'error' : 'loaded';

  const hasWatched = words !== null && words.length > 0;
  const dueCount = words ? words.filter((word) => word.status === 'due').length : 0;

  return (
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-10">
        <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">
          {wordLoadState === 'loaded' && hasWatched
            ? `${greeting}${firstName ? `, ${firstName}` : ''}.`
            : `Welcome${firstName ? `, ${firstName}` : ''}.`}
        </h1>

        {wordLoadState === 'loaded' &&
          (hasWatched ? (
            <StreakSummary dueCount={dueCount} streakDays={streak} />
          ) : (
            <WatchNudge language={language} languageName={languageName} />
          ))}
      </div>

      {wordLoadState === 'loading' && (
        <div className="mt-10" role="status" aria-live="polite" aria-label="Loading your practice queue">
          <div className="mb-5 flex items-center gap-3 text-body-sm text-muted">
            <div className="home-loading-boxes" aria-hidden="true">
              <span className="home-loading-box" />
              <span className="home-loading-box" />
              <span className="home-loading-box" />
            </div>
            <span>Loading your practice queue…</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl bg-surface p-5">
                <Skeleton className="mb-7 h-10 w-10 rounded-xl" />
                <Skeleton className="mb-3 h-5 w-28 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}

      {wordLoadState === 'error' && (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-12 text-center">
          <AlertCircle className="h-7 w-7 text-accent" aria-hidden="true" />
          <div>
            <p className="font-semibold text-primary">Your practice queue took too long to load</p>
            <p className="mt-1 text-body-sm text-secondary">Please try again. Your saved progress is safe.</p>
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
          <WordQueue words={words} languageName={languageName} />
        </>
      )}
    </div>
  );
}
