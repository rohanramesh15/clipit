import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Book, TrendingUp, RotateCw, Play } from 'lucide-react';
import { getAnalyticsSummary, getActivityHeatmap, getActivityHeatmapCurrentYear } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

type TimeRange = '7d' | '30d' | '1y';

const TIME_RANGES: {
  id: TimeRange;
  label: string;
  days: number;
  description: string;
}[] = [
  { id: '7d', label: '7 Days', days: 7, description: 'Last 7 Days' },
  { id: '30d', label: '30 Days', days: 30, description: 'Last 30 Days' },
  { id: '1y', label: 'Year', days: 365, description: new Date().getFullYear().toString() },
];

export function AnalyticsPage() {
  const { language } = useLanguage();
  const [activeRange, setActiveRange] = useState<TimeRange>('30d');
  const [analytics, setAnalytics] = useState({
    wordsLearned: 0,
    totalReviews: 0,
    hoursWatched: 0,
    streak: 0,
  });

  // Load analytics data
  useEffect(() => {
    const data = getAnalyticsSummary();
    setAnalytics({
      wordsLearned: data.wordsLearned,
      totalReviews: data.totalReviews,
      hoursWatched: 0, // Will be fetched from API
      streak: data.streak,
    });

    // Fetch watch time from backend
    fetch(`${API}/videos/stats/watch-time?lang=${language}`)
      .then(res => res.json())
      .then(data => {
        setAnalytics(prev => ({
          ...prev,
          hoursWatched: data.total_hours || 0,
        }));
      })
      .catch(() => {
        // Fallback: keep at 0 if API fails
      });
  }, [language]);

  const stats = [
    {
      id: 1,
      label: 'Day Streak',
      value: analytics.streak.toString(),
      icon: Flame,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
    {
      id: 2,
      label: 'Words Learned',
      value: analytics.wordsLearned.toString(),
      icon: Book,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 3,
      label: 'Total Reviews',
      value: analytics.totalReviews.toString(),
      icon: RotateCw,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      id: 4,
      label: 'Hours Watched',
      value: analytics.hoursWatched < 1
        ? `${Math.round(analytics.hoursWatched * 60)}m`
        : `${analytics.hoursWatched}h`,
      icon: Play,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
  ];

  const currentRange = TIME_RANGES.find((r) => r.id === activeRange)!;

  // Get real heatmap data from review history
  const heatmapData = useMemo(() => {
    // Use current calendar year for year view, otherwise use last N days
    if (activeRange === '1y') {
      return getActivityHeatmapCurrentYear();
    }
    return getActivityHeatmap(currentRange.days);
  }, [activeRange, currentRange.days]);

  const getIntensityColor = (level: number) => {
    switch (level) {
      case 0:
        return 'bg-white/5';
      case 1:
        return 'bg-accent/20';
      case 2:
        return 'bg-accent/40';
      case 3:
        return 'bg-accent/70';
      case 4:
        return 'bg-accent';
      default:
        return 'bg-white/5';
    }
  };

  // For 1y, use a horizontal GitHub-style layout (7 rows x N columns)
  const isCompactView = activeRange === '1y';
  const weeksCount = Math.ceil(heatmapData.length / 7);

  return (
    <div className="min-h-screen pb-20 max-w-6xl mx-auto px-4 pt-8">
      <h1 className="text-3xl font-heading font-bold text-primary mb-8">
        Your Progress
      </h1>

      <div className="space-y-8 mb-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index + 0.3 }}
              className="bg-surface border border-white/5 rounded-2xl p-6 flex items-start justify-between hover:bg-surface-hover transition-colors group"
            >
              <div>
                <p className="text-secondary text-sm font-medium mb-1">
                  {stat.label}
                </p>
                <h3 className="text-3xl font-bold text-primary group-hover:text-accent transition-colors">
                  {stat.value}
                </h3>
              </div>
              <div
                className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}
              >
                <stat.icon className="w-6 h-6" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Activity Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-surface border border-white/5 rounded-2xl p-6"
        >
            {/* Header with Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-primary">Activity Log</h3>
              </div>

              {/* Time Range Toggle */}
              <div className="flex items-center bg-app/50 rounded-lg p-1 border border-white/5">
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.id}
                    onClick={() => setActiveRange(range.id)}
                    className={`
                      relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                      ${activeRange === range.id ? 'text-primary' : 'text-muted hover:text-secondary'}
                    `}
                  >
                    {activeRange === range.id && (
                      <motion.div
                        layoutId="heatmap-range"
                        className="absolute inset-0 bg-white/10 rounded-md"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <span className="relative z-10">{range.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Heatmap Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRange}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {isCompactView ? (
                  /* GitHub-style: 7 rows (days) x N columns (weeks) - fits without scrolling */
                  <div className="flex gap-[2px]">
                    {/* Day labels */}
                    <div className="flex flex-col gap-[2px] shrink-0 pr-1">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                        <div
                          key={i}
                          className="text-[8px] text-muted font-medium w-[14px] h-[14px] flex items-center"
                        >
                          {i % 2 === 0 ? day : ''}
                        </div>
                      ))}
                    </div>
                    {/* Weeks as columns */}
                    {Array.from({ length: weeksCount }).map((_, weekIdx) => (
                      <div key={weekIdx} className="flex flex-col gap-[2px]">
                        {Array.from({ length: 7 }).map((_, dayIdx) => {
                          const dataIdx = weekIdx * 7 + dayIdx;
                          if (dataIdx >= heatmapData.length) {
                            return <div key={dayIdx} className="w-[14px] h-[14px]" />;
                          }
                          const dayData = heatmapData[dataIdx];
                          return (
                            <motion.div
                              key={dayIdx}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: Math.min(weekIdx * 0.005, 0.3) }}
                              className={`w-[14px] h-[14px] rounded-sm ${getIntensityColor(dayData.intensity)} hover:ring-1 ring-accent/50 transition-all cursor-pointer`}
                              title={`${dayData.date}: ${dayData.intensity > 0 ? 'Active' : 'No activity'}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Standard grid: 7 columns with smaller blocks */
                  <div className="flex justify-center">
                    <div className="grid grid-cols-7 gap-2">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                        <div
                          key={i}
                          className="text-center text-xs text-muted font-medium mb-1 w-10 h-5"
                        >
                          {day}
                        </div>
                      ))}
                      {heatmapData.map((day, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: Math.min(0.1 + i * 0.02, 0.8) }}
                          className={`w-10 h-10 rounded-md ${getIntensityColor(day.intensity)} hover:ring-2 ring-accent/50 transition-all cursor-pointer`}
                          title={`${day.date}: ${day.intensity > 0 ? 'Active' : 'No activity'}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[10px] text-muted">
                    {currentRange.description}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted mr-1">Less</span>
                    {[0, 1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`w-3 h-3 rounded-sm ${getIntensityColor(level)}`}
                      />
                    ))}
                    <span className="text-[10px] text-muted ml-1">More</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
