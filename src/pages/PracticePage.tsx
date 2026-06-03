import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GalleryVerticalEnd, AudioLines, WandSparkles, ArrowRight, Target, Flame, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loadCardData, getAnalyticsSummary } from '../services/fsrs';
import { API_BASE_URL } from '../config';

type Page =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface PracticePageProps {
  onNavigate: (page: Page) => void;
}

interface Mode {
  id: Page;
  label: string;
  description: string;
  Icon: typeof ArrowRight;
  color: string;
}

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// A few varied greetings per time-of-day so it doesn't read the same every visit.
const GREETINGS: Record<string, string[]> = {
  night: ['Still up', 'Working late', 'Good evening', 'Welcome back'],
  morning: ['Good morning', 'Rise and shine', 'Morning', 'Welcome back'],
  afternoon: ['Good afternoon', 'Hello again', 'Welcome back', 'Hey'],
  evening: ['Good evening', 'Welcome back', 'Evening', 'Hello again'],
};

function pickGreeting(): string {
  const h = new Date().getHours();
  const bucket = h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const arr = GREETINGS[bucket];
  return arr[Math.floor(Math.random() * arr.length)];
}

// Daily goal in cards, derived from the saved daily-goal minutes (mirrors
// ReviewSessionContext's mapping).
function goalCards(): number {
  const m = parseInt(localStorage.getItem('daily_goal') || '15', 10);
  return m === 5 ? 10 : m === 30 ? 60 : m === 60 ? 120 : 30;
}

// A playful daily-goal tracker: practiced vs goal, with a celebratory
// "on fire" state when the learner blows past their target.
function GoalProgress({ reviewed, goal }: { reviewed: number | null; goal: number }) {
  if (reviewed === null) {
    return (
      <div className="mb-10">
        <div className="h-2.5 rounded-full animate-pulse" style={{ background: hexA('#EA7B7B', 0.15) }} />
      </div>
    );
  }
  const reached = reviewed >= goal && goal > 0;
  const over = reviewed > goal;
  const pct = goal > 0 ? Math.min(100, (reviewed / goal) * 100) : 0;
  const Icon = over ? Flame : reached ? Trophy : Target;

  return (
    <div className="mb-16">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: '#EA7B7B' }} />
          <span className="text-sm font-semibold text-primary">
            {over ? "You're on fire!" : reached ? 'Daily goal reached!' : "Today's goal"}
          </span>
        </div>
        <span className="text-sm font-medium text-secondary tabular-nums">
          {reviewed} / {goal} cards
        </span>
      </div>

      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: '#ffffff', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)' }}>
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: '#C4625A' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function countDue(): number {
  const all = loadCardData();
  const now = Date.now();
  let due = 0;
  for (const key in all) {
    const c = all[key]?.card;
    if (c && new Date(c.due).getTime() <= now) due++;
  }
  return due;
}

export function PracticePage({ onNavigate }: PracticePageProps) {
  const { user, token } = useAuth();
  const firstName = (user?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];

  const { dueCount, streak, greeting } = useMemo(
    () => ({ dueCount: countDue(), streak: getAnalyticsSummary().streak, greeting: pickGreeting() }),
    [],
  );

  // Today's practiced-card count vs the daily goal (for the progress tracker).
  const goal = useMemo(() => goalCards(), []);
  const [reviewedToday, setReviewedToday] = useState<number | null>(null);
  useEffect(() => {
    if (!token) { setReviewedToday(0); return; }
    let alive = true;
    const tz = new Date().getTimezoneOffset();
    fetch(`${API_BASE_URL}/fsrs/reviews/today?tz_offset_minutes=${tz}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((d) => { if (alive) setReviewedToday(d.count || 0); })
      .catch(() => { if (alive) setReviewedToday(0); });
    return () => { alive = false; };
  }, [token]);

  const modes: Mode[] = [
    {
      id: 'flashcards',
      label: 'Flash Cards',
      description: 'Review your words with spaced repetition.',
      Icon: GalleryVerticalEnd,
      color: '#C4625A', // terracotta (app accent)
    },
    {
      id: 'converse-v2',
      label: 'Voice Chat',
      description: 'Talk with an AI partner that uses your words.',
      Icon: AudioLines,
      color: '#D98A6E', // warm salmon
    },
    {
      id: 'madlibs',
      label: 'Mad Libs',
      description: 'Fill in blanks in a sentence.',
      Icon: WandSparkles,
      color: '#A65049', // deep brick
    },
  ];

  // Subtitle: only show a due count when there's something due (no "Nothing due").
  const subtitle = [
    dueCount > 0 ? `${dueCount} due today` : null,
    streak > 0 ? `${streak} day streak` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8">
      <h1 className="text-3xl sm:text-4xl font-heading font-bold text-primary mb-3">
        {greeting}{firstName ? `, ${firstName}` : ''}.
      </h1>
      {subtitle ? (
        <p className="text-secondary mb-10 text-base">{subtitle}</p>
      ) : (
        <div className="mb-10" />
      )}

      <GoalProgress reviewed={reviewedToday} goal={goal} />

      <h2 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Practice options</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {modes.map((m, i) => (
          <motion.button
            key={m.id}
            type="button"
            onClick={() => onNavigate(m.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i + 0.1 }}
            whileHover={{ y: -4 }}
            style={{ backgroundColor: m.color }}
            className="group flex flex-col text-left rounded-2xl p-7 min-h-[260px] shadow-sm"
          >
            <m.Icon className="w-9 h-9 mb-6" strokeWidth={1.75} style={{ color: '#fff' }} />
            <h3 className="font-heading font-bold text-2xl mb-2" style={{ color: '#fff' }}>
              {m.label}
            </h3>
            <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {m.description}
            </p>
            <div className="flex items-center justify-end mt-auto pt-6">
              <ArrowRight className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
