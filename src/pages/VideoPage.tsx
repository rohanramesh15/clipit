import React, { useState, Component } from 'react';
import {
  Play,
  Clock,
  BookOpen,
  Sparkles,
  History,
  Filter,
  Youtube,
  Tv,
  ExternalLink } from
'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// --- Types ---
type Platform = 'youtube' | 'netflix';
interface HistoryItem {
  id: number;
  platform: Platform;
  title: string;
  channel?: string;
  show?: string;
  duration: string;
  watchedAt: string;
  progress: number;
  wordsExtracted: number;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  thumbnail: string;
}
// --- Mock Data ---
const MOCK_HISTORY: HistoryItem[] = [
{
  id: 1,
  platform: 'youtube',
  title: 'French Street Interviews — What Do Parisians Think?',
  channel: 'Easy French',
  duration: '14:32',
  watchedAt: 'Today, 2:30 PM',
  progress: 100,
  wordsExtracted: 47,
  level: 'B1',
  thumbnail: 'bg-rose-900/40'
},
{
  id: 2,
  platform: 'youtube',
  title: 'Ordering Food in French — Real Conversations',
  channel: 'FrenchPod101',
  duration: '22:15',
  watchedAt: 'Today, 11:00 AM',
  progress: 68,
  wordsExtracted: 31,
  level: 'A2',
  thumbnail: 'bg-amber-900/40'
},
{
  id: 6,
  platform: 'netflix',
  title: 'Lupin — Season 1, Episode 3',
  show: 'Lupin',
  duration: '42:00',
  watchedAt: 'Today, 8:00 PM',
  progress: 100,
  wordsExtracted: 124,
  level: 'B2',
  thumbnail: 'bg-slate-800'
},
{
  id: 3,
  platform: 'youtube',
  title: 'Learn French with Peppa Pig 🐷',
  channel: 'French Cartoons',
  duration: '18:45',
  watchedAt: 'Yesterday',
  progress: 100,
  wordsExtracted: 62,
  level: 'A1',
  thumbnail: 'bg-pink-900/40'
},
{
  id: 4,
  platform: 'youtube',
  title: 'French News — Journal de 20h',
  channel: 'France 2',
  duration: '31:00',
  watchedAt: 'Yesterday',
  progress: 45,
  wordsExtracted: 89,
  level: 'C1',
  thumbnail: 'bg-blue-900/40'
},
{
  id: 7,
  platform: 'netflix',
  title: 'Emily in Paris — S2E5',
  show: 'Emily in Paris',
  duration: '28:00',
  watchedAt: 'Yesterday',
  progress: 100,
  wordsExtracted: 78,
  level: 'A2',
  thumbnail: 'bg-fuchsia-900/40'
},
{
  id: 5,
  platform: 'youtube',
  title: 'Cooking Ratatouille with a French Chef',
  channel: 'Cuisine Française',
  duration: '25:10',
  watchedAt: '2 days ago',
  progress: 100,
  wordsExtracted: 55,
  level: 'B2',
  thumbnail: 'bg-orange-900/40'
},
{
  id: 8,
  platform: 'netflix',
  title: 'Intouchables',
  show: 'Film',
  duration: '1:52:00',
  watchedAt: '3 days ago',
  progress: 72,
  wordsExtracted: 203,
  level: 'B1',
  thumbnail: 'bg-emerald-900/40'
},
{
  id: 9,
  platform: 'netflix',
  title: 'Call My Agent — S1E1',
  show: 'Dix Pour Cent',
  duration: '52:00',
  watchedAt: '4 days ago',
  progress: 100,
  wordsExtracted: 156,
  level: 'C1',
  thumbnail: 'bg-violet-900/40'
},
{
  id: 10,
  platform: 'netflix',
  title: 'The Bureau — S3E2',
  show: 'Le Bureau des Légendes',
  duration: '55:00',
  watchedAt: '5 days ago',
  progress: 35,
  wordsExtracted: 67,
  level: 'C2',
  thumbnail: 'bg-gray-800'
}];

const levelColors = {
  A1: 'bg-green-500/20 text-green-400 border-green-500/30',
  A2: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  B1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  B2: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  C1: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  C2: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
};
// --- Components ---
export function VideoPage() {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'youtube' | 'netflix'>(
    'all');
  const filteredHistory = MOCK_HISTORY.filter((item) => {
    if (activeFilter === 'all') return true;
    return item.platform === activeFilter;
  });
  // Group by date logic (simplified for mock data)
  const groupedHistory = {
    Today: filteredHistory.filter((i) => i.watchedAt.includes('Today')),
    Yesterday: filteredHistory.filter((i) => i.watchedAt.includes('Yesterday')),
    'This Week': filteredHistory.filter(
      (i) =>
      !i.watchedAt.includes('Today') && !i.watchedAt.includes('Yesterday')
    )
  };
  return (
    <div className="min-h-screen pb-20 max-w-6xl mx-auto px-4 pt-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-primary mb-2">
          Watch History
        </h1>
        <p className="text-secondary max-w-2xl">
          Content you've watched across platforms — we extract vocabulary
          automatically.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">34.2</div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              Hours Watched
            </div>
          </div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">12</div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              Videos This Week
            </div>
          </div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">847</div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              Words Extracted
            </div>
          </div>
        </div>
        <div className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">23</div>
            <div className="text-xs text-secondary uppercase tracking-wider">
              New Today
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
        <Filter className="w-4 h-4 text-secondary mr-2" />
        {(['all', 'youtube', 'netflix'] as const).map((filter) =>
        <button
          key={filter}
          onClick={() => setActiveFilter(filter)}
          className={`
              relative px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize
              ${activeFilter === filter ? 'text-primary' : 'text-secondary hover:text-primary hover:bg-white/5'}
            `}>

            {activeFilter === filter &&
          <motion.div
            layoutId="platform-filter"
            className="absolute inset-0 bg-white/10 rounded-lg"
            transition={{
              type: 'spring',
              bounce: 0.2,
              duration: 0.6
            }} />

          }
            <span className="relative z-10 flex items-center gap-2">
              {filter === 'youtube' &&
            <Youtube className="w-4 h-4 text-red-500" />
            }
              {filter === 'netflix' && <Tv className="w-4 h-4 text-red-700" />}
              {filter}
            </span>
          </button>
        )}
      </div>

      {/* History List */}
      <div className="space-y-8">
        {Object.entries(groupedHistory).map(
          ([date, items]) =>
          items.length > 0 &&
          <div key={date}>
                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-4 pl-1">
                  {date}
                </h3>
                <div className="space-y-3">
                  {items.map((item, index) =>
              <motion.div
                key={item.id}
                initial={{
                  opacity: 0,
                  y: 20
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                transition={{
                  delay: index * 0.05
                }}
                className="group bg-surface border border-white/5 rounded-xl p-3 hover:bg-surface-hover hover:border-white/10 transition-all cursor-pointer flex flex-col sm:flex-row gap-4">

                      {/* Thumbnail */}
                      <div
                  className={`relative w-full sm:w-48 aspect-video rounded-lg ${item.thumbnail} overflow-hidden shrink-0`}>

                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />

                        {/* Platform Badge */}
                        <div
                    className={`
                        absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1
                        ${item.platform === 'youtube' ? 'bg-red-600' : 'bg-[#E50914]'}
                      `}>

                          {item.platform === 'youtube' ?
                    <Youtube className="w-3 h-3 fill-current" /> :

                    <span className="font-black text-[10px]">N</span>
                    }
                          {item.platform === 'youtube' ? 'YouTube' : 'Netflix'}
                        </div>

                        {/* Duration */}
                        <div className="absolute bottom-2 right-2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-bold text-white">
                          {item.duration}
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                          <div
                      className="h-full bg-accent"
                      style={{
                        width: `${item.progress}%`
                      }} />

                        </div>

                        {/* Play Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center border border-white/20">
                            <Play className="w-3 h-3 text-white fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col justify-center py-1">
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h3 className="font-bold text-primary group-hover:text-accent transition-colors line-clamp-2">
                            {item.title}
                          </h3>
                          <ExternalLink className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>

                        <p className="text-sm text-secondary mb-3">
                          {item.channel || item.show}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-auto">
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <Clock className="w-3.5 h-3.5" />
                            {item.watchedAt.
                      replace('Today, ', '').
                      replace('Yesterday', 'Yest.')}
                          </div>

                          <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${levelColors[item.level]}`}>

                            {item.level}
                          </span>

                          <div className="flex items-center gap-1.5 text-xs text-accent/80 bg-accent/5 px-2 py-0.5 rounded border border-accent/10">
                            <BookOpen className="w-3 h-3" />
                            {item.wordsExtracted} words
                          </div>
                        </div>
                      </div>
                    </motion.div>
              )}
                </div>
              </div>

        )}

        {filteredHistory.length === 0 &&
        <div className="text-center py-20">
            <p className="text-muted text-lg">
              No watch history found for this filter.
            </p>
          </div>
        }
      </div>
    </div>);

}