import type { QueuedWord, WordStatus } from '../components/WordQueue';
import { API_BASE_URL } from '../config';
import { getCardStats, sortByPriority } from '../services/fsrs';
import { fetchWithTimeout } from './network';

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

export interface CachedMadlibDeck<Card> {
  cards: Card[];
  isComplete: boolean;
}

export interface VideoVocabulary {
  totalWords: number;
  words: string[];
}

export interface HomeQueue {
  words: QueuedWord[];
  sourceVideoCount: number;
  preparingVideoCount: number;
}

export interface VocabularySettings {
  new_cards_per_day?: number;
  priority_mode?: string;
}

export interface VocabularyListSummary {
  id: number;
  name: string;
  language: string;
  word_count: number;
  created_at: string;
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
  video_title?: string | null;
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

export class RequestError extends Error {
  constructor(message: string, readonly status?: number, readonly isTimeout = false) {
    super(message);
    this.name = 'RequestError';
  }
}

async function readJson<T>(url: string, token: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  try {
    const response = await fetchWithTimeout(url, { ...init, headers, signal });
    if (!response.ok) throw new RequestError(`Request failed (${response.status})`, response.status);
    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new RequestError('Request timed out', undefined, true);
    }
    throw error;
  }
}

export const queryKeys = {
  profile: (authUserId: string) => ['profile', authUserId] as const,
  history: (userId: number, language: string) => ['history', userId, language] as const,
  // Versioned because the cached payload gained readiness metadata. This also
  // discards empty responses saved before the matching backend was deployed.
  homeQueue: (userId: number, language: string) => ['home-queue-v3', userId, language] as const,
  flashcardDashboard: (userId: number, language: string) => ['flashcard-dashboard', userId, language] as const,
  flashcardDeck: (userId: number, language: string, videoId: string) =>
    ['flashcard-deck', userId, language, videoId] as const,
  madlibDeck: (userId: number, language: string, videoId: string) =>
    ['madlib-deck', userId, language, videoId] as const,
  videoVocabulary: (userId: number, language: string, videoId: string) =>
    ['video-vocabulary', userId, language, videoId] as const,
  vocabularySettings: (userId: number) => ['vocabulary-settings', userId] as const,
  vocabularyLists: (userId: number) => ['vocabulary-lists', userId] as const,
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

export function videoVocabularyQueryOptions(userId: number, token: string, language: string, videoId: string) {
  return {
    queryKey: queryKeys.videoVocabulary(userId, language, videoId),
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<VideoVocabulary> => {
      const data = await readJson<{ total_words?: number; vocabulary?: { word: string }[] }>(
        `${API_BASE_URL}/vocabulary/${videoId}?limit=20&lang=${language}`,
        token,
        signal,
      );
      return {
        totalWords: data.total_words || 0,
        words: Array.isArray(data.vocabulary) ? data.vocabulary.map((item) => item.word) : [],
      };
    },
  };
}

export function vocabularySettingsQueryOptions(userId: number, token: string) {
  return {
    queryKey: queryKeys.vocabularySettings(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => readJson<VocabularySettings>(
      `${API_BASE_URL}/vocab/settings`,
      token,
      signal,
    ),
  };
}

export function vocabularyListsQueryOptions(userId: number, token: string) {
  return {
    queryKey: queryKeys.vocabularyLists(userId),
    queryFn: ({ signal }: { signal: AbortSignal }) => readJson<VocabularyListSummary[]>(
      `${API_BASE_URL}/vocab/lists`,
      token,
      signal,
    ),
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

export function homeQueueQueryOptions(userId: number, token: string, language: string) {
  return {
    queryKey: queryKeys.homeQueue(userId, language),
    retry: (failureCount: number, error: unknown) => {
      if (error instanceof RequestError && error.status && error.status < 500) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 2_000),
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<HomeQueue> => {
      const queue = await readJson<{
        cards?: FlashCard[];
        source_video_count?: number;
        preparing_video_count?: number;
      }>(
        `${API_BASE_URL}/videos/home/queue?lang=${language}`,
        token,
        signal,
      );
      const deleted = getDeletedCards(language);
      const cards = (queue.cards || []).filter(
        (card) => !deleted.has(card.dictionary_form || card.target_word),
      );
      const cardByKey = new Map(cards.map((card) => [card.dictionary_form || card.target_word, card]));
      const now = Date.now();

      const words = sortByPriority([...cardByKey.keys()]).slice(0, 30).map((key) => {
        const card = cardByKey.get(key)!;
        const stats = getCardStats(key);
        const status: WordStatus = !stats || stats.isNew ? 'new' : stats.nextDue.getTime() <= now ? 'due' : 'learning';
        return {
          id: key,
          word: card.dictionary_form || card.target_word,
          meaning: card.english,
          video: card.video_title || 'Your vocabulary list',
          status,
        };
      });

      return {
        words,
        sourceVideoCount: queue.source_video_count ?? 0,
        preparingVideoCount: queue.preparing_video_count ?? 0,
      };
    },
  };
}

export function clearUserQueries(queryClient: QueryClient, userId: number) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey.includes(userId) });
}
