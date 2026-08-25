import React, { useMemo, useState } from 'react';

export interface ActivityDay {
  /** ISO date (yyyy-mm-dd) for the cell. */
  date: string;
  reviews: number;
}

const DAY_ROWS = ['M', '', 'W', '', 'F', '', ''];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function intensityClass(reviews: number, max: number): string {
  if (reviews === 0) return 'border border-subtle bg-app';
  const ratio = reviews / Math.max(max, 1);
  if (ratio > 0.75) return 'bg-accent';
  if (ratio > 0.5) return 'bg-accent/75';
  if (ratio > 0.25) return 'bg-accent/50';
  return 'bg-accent/30';
}

interface ActivityHeatmapProps {
  days: ActivityDay[];
  year: number;
  /** Renders without its own card treatment inside a larger progress surface. */
  embedded?: boolean;
}

export function ActivityHeatmap({ days, year, embedded = false }: ActivityHeatmapProps) {
  const [hovered, setHovered] = useState<ActivityDay | null>(null);

  const { weeks, max, total } = useMemo(() => {
    const cells: (ActivityDay | null)[] = [];
    if (days.length > 0) {
      const first = new Date(`${days[0].date}T00:00:00`);
      const lead = (first.getDay() + 6) % 7;
      for (let i = 0; i < lead; i += 1) cells.push(null);
    }
    cells.push(...days);
    while (cells.length % 7 !== 0) cells.push(null);
    const grouped: (ActivityDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) grouped.push(cells.slice(i, i + 7));
    return {
      weeks: grouped,
      max: days.reduce((peak, day) => Math.max(peak, day.reviews), 0),
      total: days.reduce((sum, day) => sum + day.reviews, 0),
    };
  }, [days]);

  const monthLabels = useMemo(
    () =>
      weeks.map((week, index) => {
        const firstReal = week.find((cell): cell is ActivityDay => cell !== null);
        if (!firstReal) return null;
        const date = new Date(`${firstReal.date}T00:00:00`);
        if (date.getDate() > 7) return null;
        const previous = weeks[index - 1]?.find((cell): cell is ActivityDay => cell !== null);
        if (previous && new Date(`${previous.date}T00:00:00`).getMonth() === date.getMonth()) return null;
        return MONTHS[date.getMonth()];
      }),
    [weeks],
  );

  return (
    <section
      aria-labelledby="activity-heading"
      className={embedded ? '' : 'rounded-2xl bg-surface p-6 sm:p-7'}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="activity-heading" className="font-heading text-card-title font-medium text-primary">
          Activity log
        </h2>
        <p aria-live="polite" className="text-body-sm text-secondary">
          {hovered
            ? `${formatDayLabel(hovered.date)} · ${hovered.reviews === 0 ? 'no reviews' : `${hovered.reviews} reviews`}`
            : `${total.toLocaleString()} reviews in ${year}`}
        </p>
      </div>

      <div className="mt-6">
        <div className="flex gap-[3px] pl-6">
          {monthLabels.map((label, index) => (
            <span key={index} className="flex-1 text-meta text-muted">
              {label ? <span className="relative -left-px whitespace-nowrap">{label}</span> : null}
            </span>
          ))}
        </div>

        <div className="mt-1 flex gap-[3px]">
          <div className="mr-1 flex w-5 shrink-0 flex-col gap-[3px]">
            {DAY_ROWS.map((label, index) => (
              <span key={index} className="h-[11px] text-[9px] leading-[11px] text-muted">
                {label}
              </span>
            ))}
          </div>

          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-1 flex-col gap-[3px]">
              {week.map((cell, dayIndex) =>
                cell ? (
                  <button
                    type="button"
                    key={cell.date}
                    onMouseEnter={() => setHovered(cell)}
                    onFocus={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                    onBlur={() => setHovered(null)}
                    onClick={() => setHovered(cell)}
                    aria-label={`${formatDayLabel(cell.date)} · ${cell.reviews === 0 ? 'No reviews' : `${cell.reviews} reviews`}`}
                    className={`h-[11px] w-full rounded-sm p-0 ${intensityClass(cell.reviews, max)} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary`}
                  />
                ) : (
                  <span key={`${weekIndex}-${dayIndex}`} className="h-[11px] w-full" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-subtle pt-4">
        <span className="text-body-sm font-medium text-secondary">{year}</span>
        <div className="flex items-center gap-2 text-meta text-muted">
          <span>Fewer</span>
          {['border border-subtle bg-app', 'bg-accent/30', 'bg-accent/50', 'bg-accent/75', 'bg-accent'].map((tone) => (
            <span key={tone} className={`h-[11px] w-[11px] rounded-sm ${tone}`} aria-hidden="true" />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}
