import { useMemo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
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
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 sm:px-8">
      <header className="max-w-2xl pb-8">
        <h1 className="font-heading text-section font-medium text-primary">Progress</h1>
      </header>
      <div role="status" aria-live="polite" aria-label="Loading your progress" aria-hidden="true">
        <Skeleton className="h-[25rem] w-full rounded-3xl" />
      </div>
    </div>
  );
}

function AnalyticsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 text-center sm:px-8">
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
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 sm:px-8">
      <header className="max-w-2xl pb-8">
        <h1 className="font-heading text-section font-medium text-primary">Progress</h1>
      </header>

      <section aria-label="Progress overview" className="overflow-hidden rounded-3xl border border-subtle bg-surface">
        <div className="grid gap-5 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,1.1fr)] lg:items-center lg:gap-8">
          <section aria-labelledby="streak-heading" className="min-w-0">
            <div className="flex items-start gap-10 sm:gap-14">
              <div>
                <p id="streak-heading" className="text-meta font-semibold uppercase tracking-[0.08em] text-accent">Streak</p>
                <p className="mt-1.5 font-heading text-section-lg font-medium leading-none text-primary">
                  {streak}<span className="ml-1 text-lead font-medium text-secondary">days</span>
                </p>
              </div>
              <div>
                <p className="text-meta font-semibold uppercase tracking-[0.08em] text-accent">Best run</p>
                <p className="mt-1.5 font-heading text-section-lg font-medium leading-none text-primary">
                  {longestStreak}<span className="ml-1 text-lead font-medium text-secondary">days</span>
                </p>
              </div>
            </div>

            <ul className="mt-4 grid max-w-sm grid-cols-7 gap-1.5" aria-label="Last seven days of practice">
              {lastWeek.map((day, index) => (
                <li key={day.date} className="flex flex-col items-center gap-1.5">
                  <span className={`h-4 w-full rounded-md ${day.reviews > 0 ? 'bg-accent' : 'bg-surface-hover'}`} />
                  <span className="text-meta text-muted">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
                </li>
              ))}
            </ul>
          </section>

          <dl className="grid grid-cols-1 divide-y divide-subtle border-y border-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:border-y-0 sm:border-l sm:divide-x">
            <div className="py-2.5 sm:px-4 sm:py-0 first:sm:pl-4">
              <dd className="font-heading text-card-title leading-none tabular-nums text-primary">{wordsLearned.toLocaleString()}</dd>
              <dt className="mt-1.5 text-body-sm text-secondary">Words learned</dt>
            </div>
            <div className="py-2.5 sm:px-4 sm:py-0">
              <dd className="font-heading text-card-title leading-none tabular-nums text-primary">{totalReviews.toLocaleString()}</dd>
              <dt className="mt-1.5 text-body-sm text-secondary">Total reviews</dt>
            </div>
            <div className="py-2.5 sm:px-4 sm:py-0">
              <dd className="font-heading text-card-title leading-none tabular-nums text-primary">{hoursWatchedLabel}</dd>
              <dt className="mt-1.5 text-body-sm text-secondary">Hours watched</dt>
            </div>
          </dl>
        </div>

        <div className="border-t border-subtle px-6 py-7 sm:px-8 sm:py-8">
          <ActivityHeatmap days={days} year={year} embedded />
        </div>
      </section>
    </div>
  );
}
