import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PracticeModes } from '../components/PracticeModes';
import { WordQueue, type QueuedWord, type WordStatus } from '../components/WordQueue';
import { StreakSummary } from '../components/StreakSummary';
import { WatchNudge } from '../components/WatchNudge';
import { Skeleton } from '../components/Skeleton';
import { getAnalyticsSummary, getCardStats, sortByPriority } from '../services/fsrs';
import { API_BASE_URL } from '../config';
import { fetchWithTimeout, mapWithConcurrency } from '../lib/network';

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
async function fetchCardsForVideo(videoId: string, language: string, signal: AbortSignal): Promise<FlashCard[]> {
  try {
    await fetchWithTimeout(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`, { signal });
    const vocabRes = await fetchWithTimeout(`${API_BASE_URL}/vocabulary/${videoId}?limit=20&lang=${language}`, { signal });
    if (!vocabRes.ok) return [];
    const vocab = await vocabRes.json();
    if (!vocab.total_words) return [];

    const wordList = vocab.vocabulary.map((v: { word: string }) => v.word);
    const fcRes = await fetchWithTimeout(`${API_BASE_URL}/flashcard-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language }),
      signal,
    });
    if (!fcRes.ok) return [];
    const fc = await fcRes.json();
    return (fc.flashcards || []).map((card: FlashCard) => ({ ...card, video_id: card.video_id || videoId }));
  } catch {
    return [];
  }
}

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

  // Words clipped from watched videos (+ any uploaded vocab lists) — same
  // two sources FlashcardsPage.tsx's "Study All Words" combines: uploaded
  // vocab lists via /vocab/lists/flashcards, and video-extracted vocabulary
  // via a per-video /vocabulary + /flashcard-data call (that endpoint alone
  // only covers uploaded lists — it explicitly does no video mining).
  // Capped to the most recent 8 videos so a Home-page preview doesn't fire
  // unbounded requests for accounts with a long watch history.
  const [words, setWords] = useState<QueuedWord[] | null>(null);
  const [wordLoadState, setWordLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [wordLoadAttempt, setWordLoadAttempt] = useState(0);
  useEffect(() => {
    if (!token) { setWords([]); setWordLoadState('loaded'); return; }
    let alive = true;
    const controller = new AbortController();
    setWords(null);
    setWordLoadState('loading');
    Promise.all([
      fetchWithTimeout(`${API_BASE_URL}/vocab/lists/flashcards?language=${language}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      }).then((r) => (r.ok ? r.json() : { flashcards: [] })),
      fetchWithTimeout(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      }).then((r) => (r.ok ? r.json() : { videos: [] })),
    ])
      .then(async ([vocabData, videoData]) => {
        if (!alive) return;
        const videos: TrackedVideoSummary[] = videoData.videos || [];
        const videoTitles = new Map(videos.map((v) => [v.video_id, v.title]));

        const recentVideos = videos.slice(0, 8);
        const perVideoCards = await mapWithConcurrency(
          recentVideos,
          2,
          (video) => fetchCardsForVideo(video.video_id, language, controller.signal),
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
        setWordLoadState('loaded');
      })
      .catch(() => {
        if (alive && !controller.signal.aborted) setWordLoadState('error');
      });
    return () => { alive = false; controller.abort(); };
  }, [token, language, wordLoadAttempt]);

  const hasWatched = words !== null && words.length > 0;
  const dueCount = words ? words.filter((word) => word.status === 'due').length : 0;

  return (
    <div className="mx-auto max-w-page px-5 pb-16 pt-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 pb-10">
        <h1 className="font-heading text-[2rem] font-medium leading-tight text-primary">
          {wordLoadState === 'loaded' && hasWatched
            ? `${greeting}${firstName ? `, ${firstName}` : ''}.`
            : `Welcome${firstName ? `, ${firstName}` : ''}.`}
        </h1>

        {wordLoadState === 'loaded' &&
          (hasWatched ? (
            <StreakSummary dueCount={dueCount} streakDays={streak} />
          ) : (
            <WatchNudge language={language} languageName={languageName} />
          ))}
      </div>

      {wordLoadState === 'loading' && (
        <div className="mt-10" role="status" aria-live="polite" aria-label="Loading your practice queue">
          <div className="grid gap-5 sm:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl bg-surface p-5">
                <Skeleton className="mb-7 h-10 w-10 rounded-xl" />
                <Skeleton className="mb-3 h-5 w-28 rounded-md" />
                <Skeleton className="h-4 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      )}

      {wordLoadState === 'error' && (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl bg-surface px-6 py-12 text-center">
          <AlertCircle className="h-7 w-7 text-accent" aria-hidden="true" />
          <div>
            <p className="font-semibold text-primary">Your practice queue took too long to load</p>
            <p className="mt-1 text-body-sm text-secondary">Please try again. Your saved progress is safe.</p>
          </div>
          <button
            type="button"
            onClick={() => setWordLoadAttempt((attempt) => attempt + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {wordLoadState === 'loaded' && words && (
        <>
          <PracticeModes onOpenMode={onNavigate} />
          <WordQueue words={words} languageName={languageName} />
        </>
      )}
    </div>
  );
}
