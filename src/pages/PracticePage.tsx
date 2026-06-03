import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, Mic, PenLine, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loadCardData, getAnalyticsSummary } from '../services/fsrs';

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
  meta: string;
  Icon: typeof Layers;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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
  const { user } = useAuth();
  const firstName = (user?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];

  const { dueCount, streak } = useMemo(
    () => ({ dueCount: countDue(), streak: getAnalyticsSummary().streak }),
    [],
  );

  const modes: Mode[] = [
    {
      id: 'flashcards',
      label: 'Flash Cards',
      description: 'Review your words with spaced repetition.',
      meta: dueCount > 0 ? `${dueCount} due now` : 'All caught up',
      Icon: Layers,
    },
    {
      id: 'converse-v2',
      label: 'Voice Chat',
      description: 'Talk with an AI partner that uses your words.',
      meta: 'Voice or text',
      Icon: Mic,
    },
    {
      id: 'madlibs',
      label: 'Mad Libs',
      description: 'Drop your words into living sentences.',
      meta: 'Fill the blanks',
      Icon: PenLine,
    },
  ];

  const subtitle = [
    dueCount > 0 ? `${dueCount} due today` : 'Nothing due',
    streak > 0 ? `${streak} day streak` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <div className="max-w-6xl mx-auto px-4 pt-8">
      <h1 className="text-3xl font-heading font-bold text-primary mb-1">Practice</h1>
      <p className="text-secondary mb-8">
        {greeting()}{firstName ? `, ${firstName}` : ''}.  ·  {subtitle}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {modes.map((m, i) => (
          <motion.button
            key={m.id}
            type="button"
            onClick={() => onNavigate(m.id)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i + 0.1 }}
            className="group flex flex-col text-left bg-surface border border-white/5 rounded-2xl p-7 min-h-[280px] hover:bg-surface-hover transition-colors"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6">
              <m.Icon className="w-7 h-7" strokeWidth={2} />
            </div>
            <h3 className="font-heading font-bold text-xl text-primary mb-2 group-hover:text-accent transition-colors">
              {m.label}
            </h3>
            <p className="text-sm text-secondary leading-relaxed">
              {m.description}
            </p>
            <div className="flex items-center justify-between mt-auto pt-6">
              <span className="text-sm text-muted">{m.meta}</span>
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
