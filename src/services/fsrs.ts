import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type ReviewLog,
  type RecordLogItem,
} from 'ts-fsrs';

// FSRS scheduler instance with default parameters
const params = generatorParameters({ maximum_interval: 365 });
const scheduler = fsrs(params);

// Storage key for persisted card data
const STORAGE_KEY = 'deadbird_fsrs_cards';

export interface FSRSCardData {
  word: string;
  card: Card;
  lastReview?: ReviewLog;
}

// Load all card data from localStorage
export function loadCardData(): Record<string, FSRSCardData> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    for (const key in parsed) {
      const data = parsed[key];
      if (data.card) {
        data.card.due = new Date(data.card.due);
        data.card.last_review = data.card.last_review ? new Date(data.card.last_review) : undefined;
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

// Save all card data to localStorage
export function saveCardData(data: Record<string, FSRSCardData>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Get or create FSRS card for a word
export function getOrCreateCard(word: string): FSRSCardData {
  const allCards = loadCardData();
  if (allCards[word]) {
    return allCards[word];
  }
  return {
    word,
    card: createEmptyCard(),
  };
}

// Rate a card and get the next review schedule
export function rateCard(
  word: string,
  rating: Rating,
  clipDuration?: number
): { cardData: FSRSCardData; nextDue: Date } {
  const cardData = getOrCreateCard(word);
  const now = new Date();

  const result: RecordLogItem = scheduler.next(cardData.card, now, rating);

  const updatedCardData: FSRSCardData = {
    word,
    card: result.card,
    lastReview: result.log,
  };

  // Persist
  const allCards = loadCardData();
  allCards[word] = updatedCardData;
  saveCardData(allCards);

  // Track in review history for analytics (includes watch time)
  addToReviewHistory(word, rating, clipDuration);

  return {
    cardData: updatedCardData,
    nextDue: result.card.due,
  };
}

// Get cards due for review (due date <= now)
export function getDueCards(words: string[]): string[] {
  const allCards = loadCardData();
  const now = new Date();

  return words.filter(word => {
    const cardData = allCards[word];
    if (!cardData) return true; // New cards are always due
    return cardData.card.due <= now;
  });
}
// Sort words by priority: due cards first, then by due date
export function sortByPriority(words: string[]): string[] {
  const allCards = loadCardData();

  return [...words].sort((a, b) => {
    const cardA = allCards[a];
    const cardB = allCards[b];

    // New cards come first
    if (!cardA && !cardB) return 0;
    if (!cardA) return -1;
    if (!cardB) return 1;

    // Then sort by due date
    return cardA.card.due.getTime() - cardB.card.due.getTime();
  });
}

// Get stats for display
export function getCardStats(word: string): {
  isNew: boolean;
  repetitions: number;
  stability: number;
  difficulty: number;
  nextDue: Date;
} | null {
  const allCards = loadCardData();
  const cardData = allCards[word];

  if (!cardData) {
    return null;
  }

  return {
    isNew: cardData.card.reps === 0,
    repetitions: cardData.card.reps,
    stability: cardData.card.stability,
    difficulty: cardData.card.difficulty,
    nextDue: cardData.card.due,
  };
}

// Map button names to FSRS ratings
export const RatingMap = {
  Again: Rating.Again,
  Hard: Rating.Hard,
  Good: Rating.Good,
  Easy: Rating.Easy,
} as const;

// Preview next review times for all ratings
export function previewNextReviews(word: string): {
  again: Date;
  hard: Date;
  good: Date;
  easy: Date;
} {
  const cardData = getOrCreateCard(word);
  const now = new Date();
  const results = scheduler.repeat(cardData.card, now);

  return {
    again: results[Rating.Again].card.due,
    hard: results[Rating.Hard].card.due,
    good: results[Rating.Good].card.due,
    easy: results[Rating.Easy].card.due,
  };
}

// ─── Analytics Functions ───────────────────────────────

// Storage key for review history
const HISTORY_KEY = 'deadbird_review_history';

interface ReviewHistoryEntry {
  word: string;
  rating: Rating;
  timestamp: number; // Unix timestamp
  clipDuration?: number; // Duration of video clip watched in seconds
}

// Load review history
export function loadReviewHistory(): ReviewHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save review to history (called internally by rateCard)
function addToReviewHistory(word: string, rating: Rating, clipDuration?: number): void {
  const history = loadReviewHistory();
  history.push({
    word,
    rating,
    timestamp: Date.now(),
    clipDuration,
  });
  // Keep last 1000 reviews to avoid localStorage bloat
  const trimmed = history.slice(-1000);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

// Get analytics summary
export function getAnalyticsSummary(): {
  wordsLearned: number;
  totalReviews: number;
  streak: number;
  reviewsByDate: Record<string, { count: number; correct: number }>;
} {
  const allCards = loadCardData();
  const history = loadReviewHistory();

  // Words learned = cards reviewed at least once
  const wordsLearned = Object.values(allCards).filter(c => c.card.reps > 0).length;

  // Total reviews
  const totalReviews = history.length;

  // Group reviews by date for heatmap
  const reviewsByDate: Record<string, { count: number; correct: number }> = {};
  history.forEach(h => {
    const date = new Date(h.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
    if (!reviewsByDate[date]) {
      reviewsByDate[date] = { count: 0, correct: 0 };
    }
    reviewsByDate[date].count++;
    if (h.rating === Rating.Good || h.rating === Rating.Easy) {
      reviewsByDate[date].correct++;
    }
  });

  // Calculate streak (consecutive days with reviews)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const checkDate = new Date(today);

  while (reviewsByDate[checkDate.toISOString().split('T')[0]]) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    wordsLearned,
    totalReviews,
    streak,
    reviewsByDate,
  };
}

// Get activity data for heatmap (last N days)
export function getActivityHeatmap(days: number): { date: string; intensity: number }[] {
  const { reviewsByDate } = getAnalyticsSummary();
  const result: { date: string; intensity: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find max reviews in a day for normalization
  const maxReviews = Math.max(1, ...Object.values(reviewsByDate).map(d => d.count));

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = reviewsByDate[dateStr];

    // Normalize to 0-4 intensity
    const intensity = dayData ? Math.min(4, Math.ceil((dayData.count / maxReviews) * 4)) : 0;
    result.push({ date: dateStr, intensity });
  }

  return result;
}

export { Rating };
