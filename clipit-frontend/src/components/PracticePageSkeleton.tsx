import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * Mirrors the first visible Practice-page layout so loading never moves the
 * real heading, mode cards, or word queue when data arrives.
 */
export function PracticePageSkeleton() {
  return (
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 sm:px-8" aria-hidden="true">
      <div className="flex items-end justify-between pb-10">
        <Skeleton className="h-10 w-56 rounded-lg" />
      </div>

      <div className="grid items-stretch gap-6 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-[21rem] rounded-2xl" />
        ))}
      </div>

      <section className="mt-16">
        <div className="flex items-end justify-between">
          <div>
            <Skeleton className="h-7 w-64 rounded-md" />
            <Skeleton className="mt-1 h-5 w-36 rounded-md" />
          </div>
          <Skeleton className="hidden h-8 w-64 rounded-lg sm:block" />
        </div>
        <Skeleton className="mt-6 h-[18.5rem] w-full rounded-2xl" />
      </section>
    </div>
  );
}
