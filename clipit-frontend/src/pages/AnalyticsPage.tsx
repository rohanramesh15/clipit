import { useMemo } from 'react';
import { AlertCircle, Flame, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActivityHeatmap, type ActivityDay } from '../components/ActivityHeatmap';
import { Skeleton } from '../components/Skeleton';
import { getAnalyticsSummary } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { reviewsQueryOptions, watchTimeQueryOptions } from '../lib/queries';
import { Button } from '../components/ui/button';

function AnalyticsLoadingState() {
  return (
    <div className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8" role="status" aria-live="polite" aria-label="Loading your progress">
      <Skeleton className="h-8 w-32 rounded-lg" />
      <Skeleton className="mt-8 h-24 w-full rounded-2xl" />
      <Skeleton className="mt-6 h-[16.5rem] w-full rounded-2xl" />
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
        <Button
          type="button"
          onClick={onRetry}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
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

  const hoursWatchedLabel = hoursWatched < 1 ? `${Math.round(hoursWatched * 60)}m` : `${hoursWatched}h`;

  if (isLoading) {
    return <AnalyticsLoadingState />;
  }

  if (hasLoadError) {
    return <AnalyticsErrorState onRetry={() => { void watchTime.refetch(); void reviews.refetch(); }} />;
  }

  return (
    <div className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-8">
        <h1 className="font-heading text-section font-medium text-primary">Progress</h1>
      </header>

      <section aria-label="Progress summary" className="flex min-h-24 flex-wrap items-center justify-between gap-x-6 gap-y-5 rounded-2xl border border-subtle bg-surface px-7 py-3 lg:flex-nowrap">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-4 lg:flex-nowrap">
          <div className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap text-inverse">
            <span className="font-heading text-section-lg leading-none tabular-nums">{streak}</span>
            <span className="font-heading text-lead">days</span>
          </div>

          <div className="shrink-0">
            <p className="flex items-center gap-1.5 text-body font-semibold text-accent">
              <Flame className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Current streak
            </p>
            <p className="mt-0.5 text-body text-secondary">Longest run so far: {longestStreak} days</p>
          </div>

          <ul className="flex shrink-0 items-end gap-2" aria-label="Last seven days of practice">
            {lastWeek.map((day, index) => (
              <li key={day.date} className="flex flex-col items-center gap-1.5">
                <span className={`h-6 w-6 rounded-lg ${day.reviews > 0 ? 'bg-accent' : 'bg-app'}`} />
                <span className="text-meta text-secondary">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="flex shrink-0 flex-wrap items-baseline gap-x-7 gap-y-3 text-inverse sm:flex-nowrap">
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <dd className="font-heading text-section tabular-nums">{wordsLearned.toLocaleString()}</dd>
            <dt className="text-body text-secondary">Words learned</dt>
          </div>
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <dd className="font-heading text-section tabular-nums">{totalReviews.toLocaleString()}</dd>
            <dt className="text-body text-secondary">Total reviews</dt>
          </div>
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <dd className="font-heading text-section tabular-nums">{hoursWatchedLabel}</dd>
            <dt className="text-body text-secondary">Hours watched</dt>
          </div>
        </dl>
      </section>

      <div className="mt-6">
        <ActivityHeatmap days={days} year={year} />
      </div>
    </div>
  );
}
