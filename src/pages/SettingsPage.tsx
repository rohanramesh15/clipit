import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  AlertTriangle,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { HelpOverlay, HelpTip } from '../components/HelpOverlay';
import { Avatar } from '../components/Avatar';
import { fetchTtsVoices, TtsVoice } from '../services/chat';

const settingsPageTips: HelpTip[] = [
  {
    id: 'profile',
    text: 'View and edit your profile information.',
    targetId: 'section-profile',
    position: 'right',
  },
  {
    id: 'learning',
    text: 'Set your target language, motivation, daily goal, and new cards per day.',
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

const LANGUAGES: { label: string; flag: string; value: 'ko' | 'uk' | 'es' | 'en' }[] = [
  { label: 'Korean', flag: '🇰🇷', value: 'ko' },
  { label: 'Ukrainian', flag: '🇺🇦', value: 'uk' },
  { label: 'Spanish', flag: '🇪🇸', value: 'es' },
  { label: 'English', flag: '🇬🇧', value: 'en' }
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

const STUDY_MODES = [
  { label: 'My Words', value: 'my-words', description: 'Study all vocab from your lists' },
  { label: 'All Videos', value: 'all-videos', description: 'Study words from watched videos' }
];

interface SettingsPageProps {
  onEditProfile?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export function SettingsPage({ onEditProfile, isDark, onToggleTheme }: SettingsPageProps) {
  const { user, token, logout } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const closeDeleteModal = () => {
    if (isDeletingAccount) return;
    setShowDeleteModal(false);
    setDeleteError(null);
  };

  const confirmDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setDeleteError(err.detail || 'Failed to delete account. Please try again.');
        setIsDeletingAccount(false);
        return;
      }
      logout();
    } catch (err) {
      setDeleteError('Failed to delete account. Please try again.');
      setIsDeletingAccount(false);
    }
  };

  const { language, setLanguage } = useLanguage();
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';
  const [motivation, setMotivation] = useState(() => {
    return localStorage.getItem('user_motivation') || 'pop_culture';
  });
  const [dailyGoal, setDailyGoal] = useState(() => {
    return localStorage.getItem('daily_goal') || '15';
  });
  const [notifications, setNotifications] = useState(true);
  const [newCardsPerDay, setNewCardsPerDay] = useState(10);
  const [isSavingNewCards, setIsSavingNewCards] = useState(false);
  const [defaultStudyMode, setDefaultStudyMode] = useState(() => {
    return localStorage.getItem('default_study_mode') || 'my-words';
  });
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem('tts_voice') || 'Kore');

  // Load TTS voices from backend
  useEffect(() => {
    if (!token) return;
    fetchTtsVoices(token).then(setTtsVoices).catch(() => {});
  }, [token]);

  const handleTtsVoiceChange = (voice: string) => {
    setTtsVoice(voice);
    localStorage.setItem('tts_voice', voice);
  };

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
            <Avatar user={user} size={64} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary text-lg">{displayName}</p>
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
                    onClick={() => {
                      setMotivation(m.value);
                      localStorage.setItem('user_motivation', m.value);
                    }}
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

        {/* Voice (TTS) */}
        {ttsVoices.length > 0 && (
          <section id="section-voice">
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
              Voice
            </h2>
            <div className="bg-surface border border-white/5 rounded-2xl p-5">
              <p className="font-bold text-primary mb-1">AI voice in conversations</p>
              <p className="text-sm text-secondary mb-4">
                Choose which voice the AI speaks with in Converse.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ttsVoices.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleTtsVoiceChange(v.id)}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                      ttsVoice === v.id
                        ? 'bg-accent/10 border-accent text-primary'
                        : 'bg-app/30 border-white/10 text-secondary hover:text-primary hover:border-white/20'
                    }`}>
                    <p className="text-sm font-medium">{v.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Appearance */}
        <section id="section-appearance">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Appearance
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'
              }`}>
                {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-bold text-primary">Dark mode</p>
                <p className="text-sm text-secondary">
                  {isDark ? 'Easier on the eyes at night' : 'Brighter, daytime-friendly'}
                </p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={isDark}
              onClick={onToggleTheme}
              className={`relative w-12 h-7 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 shrink-0 ${
                isDark ? 'bg-accent' : 'bg-white/10'
              }`}>
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  isDark ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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
              role="switch"
              aria-checked={notifications}
              onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-7 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50 shrink-0 ${
                notifications ? 'bg-accent' : 'bg-white/10'
              }`}>
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                  notifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
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
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full flex items-center gap-4 p-5 text-secondary hover:text-red-400 hover:bg-red-500/5 transition-all text-sm font-medium text-left rounded-b-2xl">
              <Trash2 className="w-5 h-5 shrink-0" />
              Delete Account
            </button>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={closeDeleteModal}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeletingAccount}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-primary mb-2">
                Delete your account?
              </h3>
              <p className="text-secondary text-sm mb-3">
                This action <span className="font-semibold text-primary">cannot be undone</span>. Your account and all associated data will be permanently erased, including:
              </p>
              <ul className="text-muted text-sm mb-6 space-y-1.5 pl-1">
                <li className="flex gap-2"><span className="text-red-400">•</span> Vocabulary lists and saved words</li>
                <li className="flex gap-2"><span className="text-red-400">•</span> Flashcard progress and review history</li>
                <li className="flex gap-2"><span className="text-red-400">•</span> Watched videos and mined words</li>
                <li className="flex gap-2"><span className="text-red-400">•</span> Deck and learning preferences</li>
              </ul>
              {deleteError && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {deleteError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={confirmDeleteAccount}
                  disabled={isDeletingAccount}
                  className="w-full px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                  {isDeletingAccount ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Account Permanently
                    </>
                  )}
                </button>
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeletingAccount}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-secondary hover:text-primary hover:bg-white/10 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
