import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { StreakPanel } from '../components/StreakPanel';
import { ActivityHeatmap, type ActivityDay } from '../components/ActivityHeatmap';
import { getAnalyticsSummary } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

interface ReviewEntry {
  word: string;
  language: string;
  rating: number;
  reviewed_at: string;
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
  const { token } = useAuth();
  const [wordsLearned, setWordsLearned] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [hoursWatched, setHoursWatched] = useState(0);
  const [reviewHistory, setReviewHistory] = useState<ReviewEntry[]>([]);

  useEffect(() => {
    setWordsLearned(getAnalyticsSummary().wordsLearned);

    if (token) {
      fetch(`${API_BASE_URL}/videos/stats/watch-time?lang=${language}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => setHoursWatched(data.total_hours || 0))
        .catch(() => {});

      fetch(`${API_BASE_URL}/fsrs/reviews?limit=10000`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          setReviewHistory(data.reviews || []);
          setTotalReviews(data.total || 0);
        })
        .catch(() => {});
    }
  }, [language, token]);

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

  if (totalReviews === 0) {
    return (
      <div className="mx-auto max-w-page px-5 pb-24 pt-8 sm:px-8">
        <header className="pb-8">
          <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">Your progress</h1>
          <p className="mt-1 text-body text-secondary">Everything else follows from showing up.</p>
        </header>

        <EmptyState
          title="Your first review lights this up"
          visual={
            <div className="mx-auto flex w-fit gap-[3px]">
              {Array.from({ length: 26 }).map((_, column) => (
                <div key={column} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((__, row) => (
                    <span
                      key={row}
                      className={`h-[11px] w-[11px] rounded-sm ${column === 25 && row === 3 ? 'bg-accent' : 'bg-blush'}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          }
        />
      </div>
    );
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
