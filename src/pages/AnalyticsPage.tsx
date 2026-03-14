import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Book, TrendingUp, RotateCw, Play } from 'lucide-react';
import { getAnalyticsSummary, getActivityHeatmapCurrentYear } from '../services/fsrs';
import { useLanguage } from '../context/LanguageContext';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';

const analyticsPageTips: HelpTip[] = [
  {
    id: 'stats-overview',
    text: 'Track your learning progress: streak, words learned, reviews, and watch time.',
    targetId: 'section-stats',
    position: 'right',
  },
  {
    id: 'heatmap',
    text: 'Your activity heatmap shows daily review consistency over the year.',
    targetId: 'section-heatmap',
    position: 'bottom',
  },
];

const API = 'http://localhost:8000/api';


export function AnalyticsPage() {
  const { language } = useLanguage();
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
    },
    {
      id: 2,
      label: 'Words Learned',
      value: analytics.wordsLearned.toString(),
      icon: Book,
    },
    {
      id: 3,
      label: 'Total Reviews',
      value: analytics.totalReviews.toString(),
      icon: RotateCw,
    },
    {
      id: 4,
      label: 'Hours Watched',
      value: analytics.hoursWatched < 1
        ? `${Math.round(analytics.hoursWatched * 60)}m`
        : `${analytics.hoursWatched}h`,
      icon: Play,
    },
  ];

  // Get real heatmap data from review history - current calendar year
  const heatmapData = useMemo(() => {
    return getActivityHeatmapCurrentYear();
  }, []);

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

  // GitHub-style layout (7 rows x N columns)
  const weeksCount = Math.ceil(heatmapData.length / 7);

  return (
    <div className="min-h-screen pb-20 max-w-6xl mx-auto px-4 pt-8">
      <HelpOverlay tips={analyticsPageTips} />

      <h1 className="text-3xl font-heading font-bold text-primary mb-8">
        Your Progress
      </h1>

      <div className="space-y-8 mb-12">
        {/* Stats Grid */}
        <div id="section-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <stat.icon className="w-6 h-6 text-accent mt-4" />
            </motion.div>
          ))}
        </div>

        {/* Activity Heatmap */}
        <motion.div
          id="section-heatmap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-surface border border-white/5 rounded-2xl p-6 h-[280px] flex flex-col"
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h3 className="font-bold text-primary">Activity Log</h3>
            </div>

            {/* Heatmap Grid - GitHub-style: 7 rows (days) x N columns (weeks) */}
            <div className="flex-1 flex gap-[2px]">
              {/* Day labels */}
              <div className="flex flex-col gap-[2px] shrink-0 pr-1 justify-between py-[2px]">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                  <div
                    key={i}
                    className="text-[8px] text-muted font-medium flex items-center"
                  >
                    {i % 2 === 0 ? day : ''}
                  </div>
                ))}
              </div>
              {/* Weeks as columns - flex to fill space */}
              <div className="flex-1 flex gap-[2px]">
                {Array.from({ length: weeksCount }).map((_, weekIdx) => (
                  <div key={weekIdx} className="flex-1 flex flex-col gap-[2px]">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const dataIdx = weekIdx * 7 + dayIdx;
                      if (dataIdx >= heatmapData.length) {
                        return <div key={dayIdx} className="flex-1 min-h-0" />;
                      }
                      const dayData = heatmapData[dataIdx];
                      return (
                        <motion.div
                          key={dayIdx}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: Math.min(weekIdx * 0.005, 0.3) }}
                          className={`flex-1 min-h-0 rounded-sm ${getIntensityColor(dayData.intensity)} hover:ring-1 ring-accent/50 transition-all cursor-pointer`}
                          title={`${dayData.date}: ${dayData.intensity > 0 ? 'Active' : 'No activity'}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between mt-4">
              <span className="text-[10px] text-muted">
                {new Date().getFullYear()}
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
      </div>
    </div>
  );
}
