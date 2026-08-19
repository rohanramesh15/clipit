import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { GoalProgress } from '../components/GoalProgress';
import { PracticeModes, type ModeId } from '../components/PracticeModes';
import { WordQueue, type QueuedWord, type WordStatus } from '../components/WordQueue';
import { GetStartedPanel } from '../components/GetStartedPanel';
import { WatchFirstDialog } from '../components/WatchFirstDialog';
import { getAnalyticsSummary, getCardStats, sortByPriority } from '../services/fsrs';
import { API_BASE_URL } from '../config';

type Page =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface PracticePageProps {
  onNavigate: (page: Page) => void;
}

interface FlashCard {
  target_word: string;
  dictionary_form: string;
  english: string;
  video_id: string | null;
}

interface TrackedVideoSummary {
  video_id: string;
  title: string;
}

// Mirrors FlashcardsPage.tsx's fetchCardsForVideo: vocabulary extracted from a
// specific watched video only becomes flashcard-shaped (with a sentence,
// translation, and timestamp) via a second call to /flashcard-data — there's
// no single endpoint that returns everything a user has clipped from videos.
async function fetchCardsForVideo(videoId: string, language: string): Promise<FlashCard[]> {
  try {
    await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`);
    const vocabRes = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=20&lang=${language}`);
    if (!vocabRes.ok) return [];
    const vocab = await vocabRes.json();
    if (!vocab.total_words) return [];

    const wordList = vocab.vocabulary.map((v: { word: string }) => v.word);
    const fcRes = await fetch(`${API_BASE_URL}/flashcard-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language }),
    });
    if (!fcRes.ok) return [];
    const fc = await fcRes.json();
    return (fc.flashcards || []).map((card: FlashCard) => ({ ...card, video_id: card.video_id || videoId }));
  } catch {
    return [];
  }
}

const MODE_LABELS: Record<ModeId, string> = {
  flashcards: 'Flash cards',
  'converse-v2': 'Voice chat',
  madlibs: 'Mad libs',
};

// A few varied greetings per time-of-day so it doesn't read the same every visit.
const GREETINGS: Record<string, string[]> = {
  night: ['Still up', 'Working late', 'Good evening'],
  morning: ['Good morning', 'Rise and shine', 'Morning'],
  afternoon: ['Good afternoon', 'Hello again', 'Hey'],
  evening: ['Good evening', 'Evening', 'Welcome back'],
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

const DELETED_CARDS_KEY = 'lipit_deleted_cards';
function getDeletedCards(language: string): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return new Set(parsed[language] || []);
  } catch {
    return new Set();
  }
}

export function PracticePage({ onNavigate }: PracticePageProps) {
  const { user, token } = useAuth();
  const { language, languageName } = useLanguage();
  const firstName = (user?.full_name || user?.email?.split('@')[0] || '').split(' ')[0];

  const { streak, greeting } = useMemo(
    () => ({ streak: getAnalyticsSummary().streak, greeting: pickGreeting() }),
    [],
  );

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

  // Words clipped from watched videos (+ any uploaded vocab lists) — same
  // two sources FlashcardsPage.tsx's "Study All Words" combines: uploaded
  // vocab lists via /vocab/lists/flashcards, and video-extracted vocabulary
  // via a per-video /vocabulary + /flashcard-data call (that endpoint alone
  // only covers uploaded lists — it explicitly does no video mining).
  // Capped to the most recent 8 videos so a Home-page preview doesn't fire
  // unbounded requests for accounts with a long watch history.
  const [words, setWords] = useState<QueuedWord[] | null>(null);
  useEffect(() => {
    if (!token) { setWords([]); return; }
    let alive = true;
    Promise.all([
      fetch(`${API_BASE_URL}/vocab/lists/flashcards?language=${language}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : { flashcards: [] })),
      fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => (r.ok ? r.json() : { videos: [] })),
    ])
      .then(async ([vocabData, videoData]) => {
        if (!alive) return;
        const videos: TrackedVideoSummary[] = videoData.videos || [];
        const videoTitles = new Map(videos.map((v) => [v.video_id, v.title]));

        const recentVideos = videos.slice(0, 8);
        const perVideoCards = await Promise.all(
          recentVideos.map((v) => fetchCardsForVideo(v.video_id, language)),
        );
        if (!alive) return;

        const deleted = getDeletedCards(language);
        const cards: FlashCard[] = [...(vocabData.flashcards || []), ...perVideoCards.flat()].filter(
          (card: FlashCard) => !deleted.has(card.dictionary_form || card.target_word),
        );
        const cardByKey = new Map(cards.map((card) => [card.dictionary_form || card.target_word, card]));
        const sortedKeys = sortByPriority([...cardByKey.keys()]).slice(0, 30);
        const now = Date.now();

        const queued: QueuedWord[] = sortedKeys.map((key) => {
          const card = cardByKey.get(key)!;
          const stats = getCardStats(key);
          const status: WordStatus = !stats || stats.isNew ? 'new' : stats.nextDue.getTime() <= now ? 'due' : 'learning';
          return {
            id: key,
            word: card.dictionary_form || card.target_word,
            meaning: card.english,
            video: (card.video_id && videoTitles.get(card.video_id)) || 'Your vocabulary list',
            status,
          };
        });
        setWords(queued);
      })
      .catch(() => { if (alive) setWords([]); });
    return () => { alive = false; };
  }, [token, language]);

  const isEmpty = words !== null && words.length === 0;

  const [blockedMode, setBlockedMode] = useState<ModeId | null>(null);
  const handleModeClick = (id: ModeId) => {
    if (isEmpty) {
      setBlockedMode(id);
      return;
    }
    onNavigate(id);
  };

  return (
    <div className="mx-auto max-w-page px-5 sm:px-8" style={{ paddingTop: '32px', paddingBottom: '32px' }}>
      <div
        className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5"
        style={{ paddingBottom: isEmpty ? '32px' : '72px' }}
      >
        <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">
          {isEmpty ? `Welcome, ${firstName}.` : `${greeting}${firstName ? `, ${firstName}` : ''}.`}
        </h1>

        {!isEmpty && (
          <div className="flex w-full items-center gap-6 sm:w-auto">
            {streak > 0 && (
              <span className="flex shrink-0 items-center gap-2 text-body-sm font-medium text-secondary">
                <Flame className="h-4 w-4 text-accent" aria-hidden="true" />
                {streak} day streak
              </span>
            )}
            <div className="w-full min-w-[12rem] sm:w-64">
              <GoalProgress reviewed={reviewedToday ?? 0} goal={goal} />
            </div>
          </div>
        )}
      </div>

      {isEmpty && (
        <div className="mb-10">
          <GetStartedPanel firstName={firstName} onUploadList={() => onNavigate('vocabulary')} />
        </div>
      )}

      <PracticeModes onOpenMode={handleModeClick} isLocked={isEmpty} />
      {!isEmpty && words && <WordQueue words={words} />}

      <AnimatePresence>
        {blockedMode && (
          <WatchFirstDialog
            modeLabel={MODE_LABELS[blockedMode]}
            language={languageName}
            onClose={() => setBlockedMode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
