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
import { NavigationIconButton } from '../components/NavigationIconButton';
import { fetchTtsVoices, fetchVoiceSample, type TtsVoice } from '../services/chat';
import { queryClient } from '../lib/queryClient';
import { queryKeys, vocabularySettingsQueryOptions } from '../lib/queries';
import { Button } from '../components/ui/button';
import { SingleSelectFilter } from '../components/filters/filter-controls';

const DAILY_GOAL_OPTIONS = [
  { minutes: 5, label: '5 min', cards: 10 },
  { minutes: 15, label: '15 min', cards: 30 },
  { minutes: 30, label: '30 min', cards: 60 },
  { minutes: 60, label: '1 hour+', cards: 120 },
];

type Page = 'video' | 'practice' | 'flashcards' | 'analytics' | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';
interface SettingsPageProps { onNavigate: (page: Page) => void; }

export function SettingsPage({ onNavigate }: SettingsPageProps) {
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
    if (!token || !user) return;
    const cached = queryClient.getQueryData<{ new_cards_per_day?: number }>(queryKeys.vocabularySettings(user.id));
    if (cached?.new_cards_per_day !== undefined) setNewCards(cached.new_cards_per_day);
    void queryClient.ensureQueryData(vocabularySettingsQueryOptions(user.id, token))
      .then((data) => {
        if (data.new_cards_per_day !== undefined) setNewCards(data.new_cards_per_day);
      })
      .catch(() => {});
  }, [token, user]);

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
      if (user) {
        queryClient.setQueryData(queryKeys.vocabularySettings(user.id), (current: { new_cards_per_day?: number } | undefined) => ({
          ...current,
          new_cards_per_day: clamped,
        }));
      }
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
    <div className="mx-auto w-full max-w-page px-5 pb-24 pt-8 sm:px-8">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0 lg:sticky lg:top-24 lg:z-40 lg:self-start">
          <header className="flex flex-wrap items-start justify-between gap-4 bg-app pb-8">
            <div>
              <div className="-ml-2 flex items-center gap-2">
                <NavigationIconButton direction="back" label="Back to Practice" onClick={() => onNavigate('practice')} />
                <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">Settings</h1>
              </div>
              <p className="mt-1 text-body text-secondary">Changes save as you make them.</p>
            </div>
          </header>

          <section aria-labelledby="profile-heading" className="w-full rounded-2xl border border-subtle bg-surface p-5">
            <h2 id="profile-heading" className="sr-only">
              Profile
            </h2>
            <div className="flex items-center gap-4">
              <Avatar user={user} size={48} textClassName="text-body font-semibold" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-semibold text-primary">{user?.full_name || user?.email?.split('@')[0] || 'User'}</p>
                <p className="truncate text-body-sm text-muted">{user?.email ?? ''}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="min-w-0 lg:pt-2">
          <section aria-labelledby="learning-heading" className="w-full">
            <h2 id="learning-heading" className="font-heading text-card-title text-primary">
              Learning
            </h2>

            <div className="mt-2 w-full">
              <SettingRow label="Daily goal" description={`How much time would you like to learn each day? This sets a daily target of about ${cardTarget} cards.`}>
                <SingleSelectFilter
                  label="Daily goal"
                  options={DAILY_GOAL_OPTIONS.map((option) => ({ value: String(option.minutes), label: option.label }))}
                  value={String(goalMinutes)}
                  onValueChange={(nextGoal) => {
                    const minutes = Number(nextGoal);
                    setGoalMinutes(minutes);
                    localStorage.setItem('daily_goal', String(minutes));
                    markSaved();
                  }}
                  className="max-w-full overflow-x-auto"
                />
              </SettingRow>

              <SettingRow label="New cards per day" description="How many unseen words enter your reviews each day. Set to 0 to only review what you already have." htmlFor="new-cards">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => saveNewCards(newCards - 5)}
                    variant="secondary"
                    size="icon"
                    aria-label="Five fewer new cards"
                    className="h-9 w-9"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <input
                    id="new-cards"
                    type="number"
                    min={0}
                    value={newCards}
                    onChange={(event) => saveNewCards(parseInt(event.target.value, 10) || 0)}
                    className="w-20 rounded-lg border border-subtle bg-app px-3 py-2 text-center text-body font-semibold tabular-nums text-primary transition-colors duration-150 ease-swift focus:border-accent focus:outline-none"
                  />
                  <Button
                    type="button"
                    onClick={() => saveNewCards(newCards + 5)}
                    variant="secondary"
                    size="icon"
                    aria-label="Five more new cards"
                    className="h-9 w-9"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <span className="text-body-sm text-muted">cards</span>
                </div>
              </SettingRow>
            </div>
          </section>

          {ttsVoices.length > 0 && (
            <section aria-labelledby="ai-voice-heading" className="mt-10 w-full">
              <h2 id="ai-voice-heading" className="font-heading text-card-title text-primary">
                AI Voice
              </h2>

              <div className="mt-2 w-full">
                <SettingRow description="Tap a voice to hear a short sample. Your selected voice becomes your default voice." layout="stacked">
                  <VoiceSelector voices={ttsVoices} selectedId={voiceId} onSelect={handleVoiceChange} getSampleUrl={getVoiceSampleUrl} />
                </SettingRow>
              </div>
            </section>
          )}

          <section aria-labelledby="account-heading" className="mt-10 w-full">
            <h2 id="account-heading" className="font-heading text-card-title text-primary">
              Account
            </h2>

            <div className="mt-2 w-full">
              <SettingRow label="Log out" description="Sign out of ClipIt on this device.">
                <Button
                  type="button"
                  onClick={logout}
                  variant="secondary"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Log out
                </Button>
              </SettingRow>

              <SettingRow label="Delete account" description="Permanently erase your account, decks, and review history. This can't be undone.">
                <Button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  variant="destructive"
                >
                  Delete account
                </Button>
              </SettingRow>
            </div>
          </section>
        </div>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-3">
        <AnimatePresence>
          {savedAt !== null && (
            <motion.span
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-sage-mid/50 bg-sage-soft px-4 py-2 text-body-sm font-semibold text-sage-deep shadow-pop"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Settings saved
            </motion.span>
          )}
        </AnimatePresence>
      </div>

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
