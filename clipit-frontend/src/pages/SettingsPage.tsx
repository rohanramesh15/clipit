import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Minus, Plus, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../config';
import { SettingRow } from '../components/SettingRow';
import { DeleteAccountDialog } from '../components/DeleteAccountDialog';
import { Avatar } from '../components/Avatar';
import { VoiceSelector } from '../components/VoiceSelector';
import { fetchTtsVoices, fetchVoiceSample, type TtsVoice } from '../services/chat';

const DAILY_GOAL_OPTIONS = [
  { minutes: 5, label: '5 min', cards: 10 },
  { minutes: 15, label: '15 min', cards: 30 },
  { minutes: 30, label: '30 min', cards: 60 },
  { minutes: 60, label: '1 hour+', cards: 120 },
];

export function SettingsPage() {
  const { user, token, logout } = useAuth();
  const { language } = useLanguage();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [goalMinutes, setGoalMinutes] = useState(() => parseInt(localStorage.getItem('daily_goal') || '15', 10));
  const [newCards, setNewCards] = useState(10);
  const [voiceId, setVoiceId] = useState(() => localStorage.getItem('tts_voice') || 'Kore');
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const voiceSampleUrls = useRef<Map<string, string>>(new Map());

  const markSaved = () => setSavedAt(Date.now());

  useEffect(() => {
    const cache = voiceSampleUrls.current;
    return () => cache.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const getVoiceSampleUrl = async (voiceId: string) => {
    const cacheKey = `${voiceId}:${language}`;
    const cached = voiceSampleUrls.current.get(cacheKey);
    if (cached) return cached;
    const blob = await fetchVoiceSample(token!, voiceId, language);
    const url = URL.createObjectURL(blob);
    voiceSampleUrls.current.set(cacheKey, url);
    return url;
  };

  useEffect(() => {
    if (savedAt === null) return;
    const timer = window.setTimeout(() => setSavedAt(null), 1600);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    if (!token) return;
    fetchTtsVoices(token).then(setTtsVoices).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/vocab/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.new_cards_per_day !== undefined) setNewCards(data.new_cards_per_day);
      })
      .catch(() => {});
  }, [token]);

  const cardTarget = useMemo(
    () => DAILY_GOAL_OPTIONS.find((option) => option.minutes === goalMinutes)?.cards ?? 30,
    [goalMinutes],
  );

  const saveNewCards = async (value: number) => {
    const clamped = Math.max(0, value);
    setNewCards(clamped);
    markSaved();
    try {
      await fetch(`${API_BASE_URL}/vocab/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ new_cards_per_day: clamped }),
      });
    } catch (err) {
      console.error('Failed to save new cards setting:', err);
    }
  };

  const handleVoiceChange = (id: string) => {
    setVoiceId(id);
    localStorage.setItem('tts_voice', id);
    markSaved();
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
    } catch {
      setDeleteError('Failed to delete account. Please try again.');
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 pb-8">
        <div>
          <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">Settings</h1>
          <p className="mt-1 text-body text-secondary">Changes save as you make them.</p>
        </div>
        <div aria-live="polite" className="h-7">
          <AnimatePresence>
            {savedAt !== null && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                className="flex items-center gap-1.5 rounded-lg bg-blush px-3 py-1.5 text-body-sm font-medium text-accent"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Saved
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      <section aria-labelledby="profile-heading" className="w-full rounded-2xl border border-subtle bg-surface p-5">
        <h2 id="profile-heading" className="sr-only">
          Profile
        </h2>
        <div className="flex items-center gap-4">
          <Avatar user={user} size={48} textClassName="text-body font-semibold" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-body font-semibold text-primary">
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="truncate text-body-sm text-muted">{user?.email ?? ''}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="learning-heading" className="mt-10 w-full">
        <h2 id="learning-heading" className="font-heading text-card-title text-primary">
          Learning
        </h2>

        <div className="mt-2 w-full border-t border-subtle">
          <SettingRow
            label="Daily goal"
            description={`How much time can you give it each day? This sets your card target — about ${cardTarget} cards a day.`}
          >
            <div role="group" aria-label="Daily goal" className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-surface p-1">
              {DAILY_GOAL_OPTIONS.map((option) => {
                const isActive = option.minutes === goalMinutes;
                return (
                  <button
                    key={option.minutes}
                    type="button"
                    onClick={() => {
                      setGoalMinutes(option.minutes);
                      localStorage.setItem('daily_goal', String(option.minutes));
                      markSaved();
                    }}
                    aria-pressed={isActive}
                    className={`rounded-md px-3.5 py-1.5 text-body-sm font-semibold transition-colors duration-150 ease-swift ${
                      isActive ? 'bg-blush text-accent' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </SettingRow>

          <SettingRow
            label="New cards per day"
            description="How many unseen words enter your reviews each day. Set to 0 to only review what you already have."
            htmlFor="new-cards"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => saveNewCards(newCards - 5)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-subtle text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Five fewer new cards</span>
              </button>
              <input
                id="new-cards"
                type="number"
                min={0}
                value={newCards}
                onChange={(event) => saveNewCards(parseInt(event.target.value, 10) || 0)}
                className="w-20 rounded-lg border border-subtle bg-app px-3 py-2 text-center text-body font-semibold tabular-nums text-primary transition-colors duration-150 ease-swift focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => saveNewCards(newCards + 5)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-subtle text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Five more new cards</span>
              </button>
              <span className="text-body-sm text-muted">cards</span>
            </div>
          </SettingRow>
        </div>
      </section>

      {ttsVoices.length > 0 && (
        <section aria-labelledby="practice-heading" className="mt-10 w-full">
          <h2 id="practice-heading" className="font-heading text-card-title text-primary">
            Practice
          </h2>

          <div className="mt-2 w-full border-t border-subtle">
            <SettingRow
              label="AI voice"
              description="The voice your tutor speaks with in AI chat. Hear one before you commit to it."
              layout="stacked"
            >
              <VoiceSelector
                voices={ttsVoices}
                selectedId={voiceId}
                onSelect={handleVoiceChange}
                getSampleUrl={getVoiceSampleUrl}
              />
            </SettingRow>
          </div>
        </section>
      )}

      <section aria-labelledby="account-heading" className="mt-10 w-full">
        <h2 id="account-heading" className="font-heading text-card-title text-primary">
          Account
        </h2>

        <div className="mt-2 w-full border-t border-subtle">
          <SettingRow label="Log out" description="Sign out of ClipIt on this device.">
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-lg border border-subtle px-3.5 py-2 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Log out
            </button>
          </SettingRow>

          <SettingRow
            label="Delete account"
            description="Permanently erase your account, decks, and review history. This can't be undone."
          >
            <button
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
              className="rounded-lg border border-error/30 px-3.5 py-2 text-body-sm font-semibold text-error transition-colors duration-150 ease-swift hover:bg-error/10"
            >
              Delete account
            </button>
          </SettingRow>
        </div>
      </section>

      <AnimatePresence>
        {isConfirmingDelete && (
          <DeleteAccountDialog
            isDeleting={isDeletingAccount}
            error={deleteError}
            onCancel={() => {
              if (isDeletingAccount) return;
              setIsConfirmingDelete(false);
              setDeleteError(null);
            }}
            onConfirm={confirmDeleteAccount}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
