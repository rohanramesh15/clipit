import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../config';
import {
  Bell,
  Shield,
  LogOut,
  Trash2,
  ChevronRight,
  Crown,
  Layers,
} from 'lucide-react';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';

const settingsPageTips: HelpTip[] = [
  {
    id: 'profile',
    text: 'View and edit your profile information.',
    targetId: 'section-profile',
    position: 'right',
  },
  {
    id: 'learning',
    text: 'Set your target language, daily goal, and new cards per day.',
    targetId: 'section-learning',
    position: 'right',
  },
  {
    id: 'notifications',
    text: 'Toggle daily reminders to stay on track with your learning.',
    targetId: 'section-notifications',
    position: 'right',
  },
  {
    id: 'account',
    text: 'Manage your account security or log out.',
    targetId: 'section-account',
    position: 'right',
  },
];

const LANGUAGES: { label: string; flag: string; value: 'ko' | 'uk' }[] = [
  { label: 'Korean', flag: '🇰🇷', value: 'ko' },
  { label: 'Ukrainian', flag: '🇺🇦', value: 'uk' }
];

const DAILY_GOALS = [
  { label: '5 min', value: '5' },
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '1 hour+', value: '60' }
];

const STUDY_MODES = [
  { label: 'My Words', value: 'my-words', description: 'Study all vocab from your lists' },
  { label: 'All Videos', value: 'all-videos', description: 'Study words from watched videos' }
];

export function SettingsPage() {
  const { user, token, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?';
  const [dailyGoal, setDailyGoal] = useState(() => {
    return localStorage.getItem('daily_goal') || '15';
  });
  const [notifications, setNotifications] = useState(true);
  const [newCardsPerDay, setNewCardsPerDay] = useState(10);
  const [isSavingNewCards, setIsSavingNewCards] = useState(false);
  const [defaultStudyMode, setDefaultStudyMode] = useState(() => {
    return localStorage.getItem('default_study_mode') || 'my-words';
  });

  // Fetch new cards per day setting on mount
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/vocab/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        if (data.new_cards_per_day !== undefined) {
          setNewCardsPerDay(data.new_cards_per_day);
        }
      })
      .catch(err => console.error('Failed to fetch settings:', err));
  }, [token]);

  // Persist daily goal to localStorage
  const handleDailyGoalChange = (value: string) => {
    setDailyGoal(value);
    localStorage.setItem('daily_goal', value);
  };

  // Save new cards per day to API
  const handleNewCardsChange = async (value: number) => {
    const clampedValue = Math.max(0, value);
    setNewCardsPerDay(clampedValue);
    setIsSavingNewCards(true);
    try {
      await fetch(`${API_BASE_URL}/vocab/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_cards_per_day: clampedValue }),
      });
    } catch (err) {
      console.error('Failed to save new cards setting:', err);
    } finally {
      setIsSavingNewCards(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen pb-20 max-w-3xl mx-auto px-4 pt-8">
      <HelpOverlay tips={settingsPageTips} />

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-primary mb-2">
          Settings
        </h1>
        <p className="text-secondary">
          Manage your account, preferences, and integrations.
        </p>
      </div>

      <div className="space-y-10">
        {/* Profile */}
        <section id="section-profile">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Profile
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-orange-500 flex items-center justify-center text-xl font-bold text-app shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary text-lg">{user?.full_name ?? user?.email ?? 'User'}</p>
              <p className="text-sm text-secondary">{user?.email ?? ''}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Crown className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent">Member</span>
              </div>
            </div>
          </div>
        </section>

        {/* Learning Preferences */}
        <section id="section-learning">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Learning
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
            {/* Language */}
            <div>
              <label className="text-sm font-semibold text-primary mb-1 block">
                Language
              </label>
              <p className="text-xs text-secondary mb-3">
                What language are you learning?
              </p>
              <div className="flex gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLanguage(l.value)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border flex items-center gap-2 ${
                      language === l.value
                        ? 'bg-accent text-app border-accent shadow-md shadow-accent/20'
                        : 'bg-app/50 text-secondary border-white/5 hover:border-white/10 hover:text-primary'
                    }`}>
                    <span>{l.flag}</span> {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5" />

            {/* Daily Goal */}
            <div>
              <label className="text-sm font-semibold text-primary mb-1 block">
                Daily Goal
              </label>
              <p className="text-xs text-secondary mb-3">
                How much time can you dedicate daily?
              </p>
              <div className="flex gap-2 flex-wrap">
                {DAILY_GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => handleDailyGoalChange(g.value)}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      dailyGoal === g.value
                        ? 'bg-accent text-app border-accent shadow-md shadow-accent/20'
                        : 'bg-app/50 text-secondary border-white/5 hover:border-white/10 hover:text-primary'
                    }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5" />

            {/* New Cards Per Day */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="text-sm font-semibold text-primary block">
                  New Cards Per Day
                </label>
                {isSavingNewCards && (
                  <div className="w-4 h-4 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                )}
              </div>
              <p className="text-xs text-secondary mb-3">
                How many new flashcards do you want to learn each day?
              </p>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="number"
                    min="0"
                    value={newCardsPerDay}
                    onChange={(e) => handleNewCardsChange(parseInt(e.target.value) || 0)}
                    className="w-32 bg-app border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-primary text-sm font-bold focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                  />
                </div>
                <span className="text-sm text-secondary">cards</span>
              </div>
              <p className="text-xs text-muted mt-2">
                Set to 0 to only review existing cards
              </p>
            </div>

            <div className="border-t border-white/5" />

            {/* Default Study Mode */}
            <div>
              <label className="text-sm font-semibold text-primary mb-1 block">
                Default Study Mode
              </label>
              <p className="text-xs text-secondary mb-3">
                What should be selected by default on the Practice page?
              </p>
              <div className="flex gap-2 flex-wrap">
                {STUDY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setDefaultStudyMode(mode.value);
                      localStorage.setItem('default_study_mode', mode.value);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      defaultStudyMode === mode.value
                        ? 'bg-accent text-app border-accent shadow-md shadow-accent/20'
                        : 'bg-app/50 text-secondary border-white/5 hover:border-white/10 hover:text-primary'
                    }`}>
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section id="section-notifications">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Notifications
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-primary">Daily Reminders</p>
                <p className="text-xs text-secondary mt-0.5">
                  Get nudged to hit your daily study goal
                </p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${notifications ? 'bg-accent' : 'bg-white/10'}`}>
              <motion.div
                animate={{ x: notifications ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
            </button>
          </div>
        </section>

        {/* Account */}
        <section id="section-account">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Account
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl divide-y divide-white/5">
            <button className="w-full flex items-center gap-4 p-5 text-secondary hover:text-primary hover:bg-white/5 transition-all text-sm font-medium text-left rounded-t-2xl">
              <Shield className="w-5 h-5 shrink-0" />
              Privacy & Security
              <ChevronRight className="w-4 h-4 ml-auto" />
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center gap-4 p-5 text-secondary hover:text-orange-400 hover:bg-orange-500/5 transition-all text-sm font-medium text-left">
              <LogOut className="w-5 h-5 shrink-0" />
              Log Out
            </button>
            <button className="w-full flex items-center gap-4 p-5 text-secondary hover:text-red-400 hover:bg-red-500/5 transition-all text-sm font-medium text-left rounded-b-2xl">
              <Trash2 className="w-5 h-5 shrink-0" />
              Delete Account
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
