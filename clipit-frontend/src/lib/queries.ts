import type { QueryClient } from '@tanstack/react-query';
import type { QueuedWord, WordStatus } from '../components/WordQueue';
import { API_BASE_URL } from '../config';
import { getCardStats, sortByPriority } from '../services/fsrs';
import { fetchWithTimeout, mapWithConcurrency } from './network';

export interface BackendVideo {
  video_id: string;
  title: string;
  tracked_at: number;
  has_korean: number | boolean | null;
  has_ukrainian: number | boolean | null;
  has_english: number | boolean | null;
  season?: number | null;
  episode?: number | null;
  episode_title?: string | null;
}

export interface ReviewEntry {
  word: string;
  language: string;
  rating: number;
  reviewed_at: string;
}

interface ReviewResponse {
  reviews: ReviewEntry[];
  total: number;
}

interface WatchTimeResponse {
  total_hours: number;
}

interface FlashCard {
  target_word: string;
  dictionary_form: string;
  english: string;
  video_id: string | null;
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

async function readJson<T>(url: string, token: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetchWithTimeout(url, { ...init, headers, signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const queryKeys = {
  profile: (authUserId: string) => ['profile', authUserId] as const,
  history: (userId: number, language: string) => ['history', userId, language] as const,
  homeQueue: (userId: number, language: string) => ['home-queue', userId, language] as const,
  flashcardDashboard: (userId: number, language: string) => ['flashcard-dashboard', userId, language] as const,
  flashcardDeck: (userId: number, language: string, videoId: string) =>
    ['flashcard-deck', userId, language, videoId] as const,
  watchTime: (userId: number, language: string) => ['watch-time', userId, language] as const,
  reviews: (userId: number) => ['reviews', userId] as const,
};

export function historyQueryOptions(userId: number, token: string, language: string) {
  return {
    queryKey: queryKeys.history(userId, language),
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<BackendVideo[]> => {
      const data = await readJson<{ videos?: BackendVideo[] }>(
        `${API_BASE_URL}/videos/history/filtered?lang=${language}`,
        token,
        signal,
      );
      if (!Array.isArray(data.videos)) throw new Error('Invalid history response');
      return data.videos;
    },
  };
}

export function watchTimeQueryOptions(userId: number, token: string, language: string) {
  return {
    queryKey: queryKeys.watchTime(userId, language),
    queryFn: ({ signal }: { signal: AbortSignal }) => readJson<WatchTimeResponse>(
      `${API_BASE_URL}/videos/stats/watch-time?lang=${language}`,
      token,
      signal,
    ),
  };
}

export function reviewsQueryOptions(userId: number, token: string) {
  return {
    queryKey: queryKeys.reviews(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => readJson<ReviewResponse>(
      `${API_BASE_URL}/fsrs/reviews?limit=10000`,
      token,
      signal,
    ),
  };
}

async function fetchCardsForVideo(videoId: string, language: string, token: string, signal: AbortSignal): Promise<FlashCard[]> {
  try {
    await readJson(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`, token, signal);
    const vocabulary = await readJson<{ total_words?: number; vocabulary?: { word: string }[] }>(
      `${API_BASE_URL}/vocabulary/${videoId}?limit=20&lang=${language}`,
      token,
      signal,
    );
    if (!vocabulary.total_words || !Array.isArray(vocabulary.vocabulary)) return [];

    const flashcards = await readJson<{ flashcards?: FlashCard[] }>(`${API_BASE_URL}/flashcard-data`, token, signal, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: videoId,
        words: vocabulary.vocabulary.map((item) => item.word),
        word_source: 'essential',
        language,
      }),
    });
    return (flashcards.flashcards || []).map((card) => ({ ...card, video_id: card.video_id || videoId }));
  } catch {
    return [];
  }
}

export function homeQueueQueryOptions(queryClient: QueryClient, userId: number, token: string, language: string) {
  return {
    queryKey: queryKeys.homeQueue(userId, language),
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<QueuedWord[]> => {
      const [vocabulary, videos] = await Promise.all([
        readJson<{ flashcards?: FlashCard[] }>(`${API_BASE_URL}/vocab/lists/flashcards?language=${language}`, token, signal),
        queryClient.fetchQuery(historyQueryOptions(userId, token, language)),
      ]);
      const videoTitles = new Map(videos.map((video) => [video.video_id, video.title]));
      const videoCards = await mapWithConcurrency(
        videos.slice(0, 8),
        2,
        (video) => fetchCardsForVideo(video.video_id, language, token, signal),
      );
      const deleted = getDeletedCards(language);
      const cards = [...(vocabulary.flashcards || []), ...videoCards.flat()].filter(
        (card) => !deleted.has(card.dictionary_form || card.target_word),
      );
      const cardByKey = new Map(cards.map((card) => [card.dictionary_form || card.target_word, card]));
      const now = Date.now();

      return sortByPriority([...cardByKey.keys()]).slice(0, 30).map((key) => {
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
    },
  };
}

export function clearUserQueries(queryClient: QueryClient, userId: number) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey.includes(userId) });
}
