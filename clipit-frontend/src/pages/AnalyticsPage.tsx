import { useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StreakPanel } from '../components/StreakPanel';
import { ActivityHeatmap, type ActivityDay } from '../components/ActivityHeatmap';
import { Skeleton } from '../components/Skeleton';
import { getAnalyticsSummary } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { reviewsQueryOptions, watchTimeQueryOptions } from '../lib/queries';

function AnalyticsLoadingState() {
  return (
    <div className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8" role="status" aria-live="polite" aria-label="Loading your progress">
      <div className="grid gap-6 lg:grid-cols-3" aria-hidden="true">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
      </div>

      <Skeleton className="mt-6 h-52 w-full rounded-2xl" />
    </div>
  );
}

function AnalyticsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-page px-5 pb-24 pt-8 text-center sm:px-8">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-16">
        <AlertCircle className="h-8 w-8 text-accent" aria-hidden="true" />
        <div>
          <h1 className="font-heading text-card-title text-primary">Your progress took too long to load</h1>
          <p className="mt-2 text-body-sm text-secondary">Please try again. Your review history is still saved.</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}

// Longest run of consecutive active days anywhere in the year (not just the
// run ending today, unlike currentStreak below).
function longestRun(reviewsByDate: Record<string, number>, year: number): number {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  let longest = 0;
  let running = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const dateStr = cursor.toISOString().split('T')[0];
    if (reviewsByDate[dateStr]) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }
  return longest;
}

export function AnalyticsPage() {
  const { language } = useLanguage();
  const { token, user } = useAuth();
  const watchTime = useQuery({
    ...watchTimeQueryOptions(user?.id ?? 0, token ?? '', language),
    enabled: Boolean(user && token),
  });
  const reviews = useQuery({
    ...reviewsQueryOptions(user?.id ?? 0, token ?? ''),
    enabled: Boolean(user && token),
  });
  const wordsLearned = getAnalyticsSummary().wordsLearned;
  const totalReviews = reviews.data?.total ?? 0;
  const hoursWatched = watchTime.data?.total_hours ?? 0;
  const reviewHistory = reviews.data?.reviews ?? [];
  const isLoading = watchTime.isPending || reviews.isPending;
  const hasLoadError = watchTime.isError || reviews.isError;

  const year = new Date().getFullYear();

  const { days, streak, longestStreak, lastWeek } = useMemo(() => {
    const reviewsByDate: Record<string, number> = {};
    reviewHistory.forEach((r) => {
      if (r.reviewed_at) {
        const date = r.reviewed_at.split('T')[0];
        reviewsByDate[date] = (reviewsByDate[date] || 0) + 1;
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const yearDays: ActivityDay[] = [];
    for (const cursor = new Date(startOfYear); cursor <= endOfYear; cursor.setDate(cursor.getDate() + 1)) {
      if (cursor > today) break;
      const dateStr = cursor.toISOString().split('T')[0];
      yearDays.push({ date: dateStr, reviews: reviewsByDate[dateStr] || 0 });
    }

    // Current streak: consecutive active days ending today (or yesterday, so
    // the streak survives until the next review).
    const todayStr = today.toISOString().split('T')[0];
    let currentStreak = 0;
    const checkDate = new Date(today);
    if (!reviewsByDate[todayStr]) checkDate.setDate(checkDate.getDate() - 1);
    while (reviewsByDate[checkDate.toISOString().split('T')[0]]) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      days: yearDays,
      streak: currentStreak,
      longestStreak: longestRun(reviewsByDate, year),
      lastWeek: yearDays.slice(-7),
    };
  }, [reviewHistory, year]);

  const metrics = [
    { id: 'wordsLearned', label: 'Words learned', value: wordsLearned.toLocaleString() },
    { id: 'totalReviews', label: 'Total reviews', value: totalReviews.toLocaleString() },
    {
      id: 'hoursWatched',
      label: 'Hours watched',
      value: hoursWatched < 1 ? `${Math.round(hoursWatched * 60)}m` : `${hoursWatched}h`,
    },
  ];

  if (isLoading) {
    return <AnalyticsLoadingState />;
  }

  if (hasLoadError) {
    return <AnalyticsErrorState onRetry={() => { void watchTime.refetch(); void reviews.refetch(); }} />;
  }

  return (
    <div className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8">
      <header className="pb-8">
        <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">Your progress</h1>
        <p className="mt-1 text-body text-secondary">Everything else follows from showing up.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <StreakPanel streak={streak} longestStreak={longestStreak} lastWeek={lastWeek} />

        <section aria-labelledby="totals-heading" className="lg:col-span-2">
          <h2 id="totals-heading" className="sr-only">
            Totals
          </h2>
          <dl className="grid h-full grid-cols-1 divide-y divide-subtle border-t border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {metrics.map((metric) => (
              <div key={metric.id} className="flex flex-col justify-center px-0 py-5 sm:px-7 sm:first:pl-0">
                <dt className="text-body-sm text-secondary">{metric.label}</dt>
                <dd className="mt-1 font-heading text-section-lg tabular-nums text-primary">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="mt-6">
        <ActivityHeatmap days={days} year={year} />
      </div>
    </div>
  );
}
