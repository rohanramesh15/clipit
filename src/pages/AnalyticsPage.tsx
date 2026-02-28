import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Book, TrendingUp, RotateCw, Play } from 'lucide-react';
import { getAnalyticsSummary, getActivityHeatmap } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';

const API = 'http://localhost:8000/api';

type TimeRange = '7d' | '30d' | '6m' | '1y';

const TIME_RANGES: {
  id: TimeRange;
  label: string;
  days: number;
  description: string;
}[] = [
  { id: '7d', label: '7 Days', days: 7, description: 'Last 7 Days' },
  { id: '30d', label: '30 Days', days: 30, description: 'Last 30 Days' },
  { id: '6m', label: '6 Months', days: 182, description: 'Last 6 Months' },
  { id: '1y', label: '1 Year', days: 365, description: 'Last Year' },
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

  // Circular Progress Config - based on words learned (100 words = 100%)
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, analytics.wordsLearned);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

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

  // For 6m and 1y, use a horizontal GitHub-style layout (7 rows x N columns)
  const isCompactView = activeRange === '6m' || activeRange === '1y';
  const weeksCount = Math.ceil(currentRange.days / 7);

  // Get level description
  const getLevelInfo = () => {
    const words = analytics.wordsLearned;
    if (words < 50) return { level: 'Beginner', next: 'Basic', progress: (words / 50) * 100 };
    if (words < 100) return { level: 'Basic', next: 'Elementary', progress: ((words - 50) / 50) * 100 };
    if (words < 200) return { level: 'Elementary', next: 'Intermediate', progress: ((words - 100) / 100) * 100 };
    if (words < 500) return { level: 'Intermediate', next: 'Advanced', progress: ((words - 200) / 300) * 100 };
    return { level: 'Advanced', next: 'Fluent', progress: Math.min(100, ((words - 500) / 500) * 100) };
  };

  const levelInfo = getLevelInfo();

  return (
    <div className="min-h-screen pb-20 max-w-6xl mx-auto px-4 pt-8">
      <h1 className="text-3xl font-heading font-bold text-primary mb-8">
        Your Progress
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        {/* Main Progress Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-surface border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />

          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r={radius}
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-white/5"
              />
              <motion.circle
                cx="128"
                cy="128"
                r={radius}
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
                strokeLinecap="round"
                className="text-accent drop-shadow-[0_0_10px_rgba(232,168,56,0.3)]"
              />
            </svg>

            <div className="absolute flex flex-col items-center">
              <span className="text-5xl font-bold text-primary">
                {analytics.wordsLearned}
              </span>
              <span className="text-sm text-secondary uppercase tracking-wider mt-1">
                words learned
              </span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-xl font-bold text-primary">{levelInfo.level}</h3>
            <p className="text-secondary text-sm mt-1">
              {analytics.wordsLearned > 0
                ? `${Math.round(levelInfo.progress)}% to ${levelInfo.next}`
                : 'Start reviewing flashcards to track progress!'}
            </p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Activity Heatmap */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="sm:col-span-2 bg-surface border border-white/5 rounded-2xl p-6"
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
                  /* GitHub-style: 7 rows (days) x N columns (weeks) */
                  <div className="overflow-x-auto pb-2 -mx-1 px-1">
                    <div className="flex gap-1.5 min-w-0">
                      {/* Day labels */}
                      <div className="flex flex-col gap-1.5 shrink-0 pr-1">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                          <div
                            key={i}
                            className="text-[10px] text-muted font-medium h-3 flex items-center"
                          >
                            {i % 2 === 0 ? day : ''}
                          </div>
                        ))}
                      </div>
                      {/* Weeks as columns */}
                      {Array.from({ length: weeksCount }).map((_, weekIdx) => (
                        <div key={weekIdx} className="flex flex-col gap-1.5">
                          {Array.from({ length: 7 }).map((_, dayIdx) => {
                            const dataIdx = weekIdx * 7 + dayIdx;
                            if (dataIdx >= heatmapData.length) {
                              return <div key={dayIdx} className="w-3 h-3" />;
                            }
                            return (
                              <motion.div
                                key={dayIdx}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: Math.min(weekIdx * 0.01, 0.5) }}
                                className={`w-3 h-3 rounded-sm ${getIntensityColor(heatmapData[dataIdx].intensity)} hover:ring-1 ring-accent/50 transition-all cursor-pointer`}
                                title={`${heatmapData[dataIdx].date}: ${heatmapData[dataIdx].intensity > 0 ? 'Active' : 'No activity'}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Standard grid: 7 columns */
                  <div>
                    <div className="grid grid-cols-7 gap-2">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                        <div
                          key={i}
                          className="text-center text-xs text-muted font-medium mb-1"
                        >
                          {day}
                        </div>
                      ))}
                      {heatmapData.map((day, i) => (
                        <motion.div
                          key={i}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: Math.min(0.8 + i * 0.02, 1.5) }}
                          className={`aspect-square rounded-md ${getIntensityColor(day.intensity)} hover:ring-2 ring-accent/50 transition-all cursor-pointer`}
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
    </div>
  );
}
