import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Bell,
  Shield,
  LogOut,
  Trash2,
  ChevronRight,
  Crown,
} from 'lucide-react';

const LANGUAGES: { label: string; flag: string; value: 'ko' | 'uk' }[] = [
  { label: 'Korean', flag: '🇰🇷', value: 'ko' },
  { label: 'Ukrainian', flag: '🇺🇦', value: 'uk' }
];

const MOTIVATIONS = [
  { label: 'Pop Culture', value: 'pop_culture' },
  { label: 'Travel', value: 'travel' },
  { label: 'Family', value: 'family' },
  { label: 'Work', value: 'work' },
  { label: 'Romance', value: 'romance' },
  { label: 'Heritage', value: 'heritage' }
];

const DAILY_GOALS = [
  { label: '5 min', value: '5' },
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '1 hour+', value: '60' }
];

interface SettingsPageProps {
  onEditProfile?: () => void;
}

export function SettingsPage({ onEditProfile }: SettingsPageProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? '??';
  const [motivation, setMotivation] = useState('pop_culture');
  const [dailyGoal, setDailyGoal] = useState('15');
  const [notifications, setNotifications] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen pb-20 max-w-3xl mx-auto px-4 pt-8">

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
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Profile
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-orange-500 flex items-center justify-center text-xl font-bold text-app shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary text-lg">{user?.username ?? 'User'}</p>
              <p className="text-sm text-secondary">{user?.email ?? ''}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Crown className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent">Member</span>
              </div>
            </div>
            <button
              onClick={onEditProfile}
              className="text-sm font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1 shrink-0 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5">
              Edit Profile <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Learning Preferences */}
        <section>
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

            {/* Motivation */}
            <div>
              <label className="text-sm font-semibold text-primary mb-1 block">
                Motivation
              </label>
              <p className="text-xs text-secondary mb-3">
                Why are you learning the language?
              </p>
              <div className="flex gap-2 flex-wrap">
                {MOTIVATIONS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMotivation(m.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                      motivation === m.value
                        ? 'bg-accent text-app border-accent shadow-md shadow-accent/20'
                        : 'bg-app/50 text-secondary border-white/5 hover:border-white/10 hover:text-primary'
                    }`}>
                    {m.label}
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
                    onClick={() => setDailyGoal(g.value)}
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
          </div>
        </section>

        {/* Notifications */}
        <section>
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
        <section>
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
