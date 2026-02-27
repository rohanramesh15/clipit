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
  rating: Rating
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
  const now = new Date();

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

export { Rating };
