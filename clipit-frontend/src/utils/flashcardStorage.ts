// Deleted cards persistence
const DELETED_CARDS_KEY = 'lipit_deleted_cards';

export function getDeletedCards(language: string): Set<string> {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    return new Set(parsed[language] || []);
  } catch {
    return new Set();
  }
}

export function addDeletedCard(language: string, word: string) {
  try {
    const stored = localStorage.getItem(DELETED_CARDS_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    if (!parsed[language]) parsed[language] = [];
    if (!parsed[language].includes(word)) {
      parsed[language].push(word);
    }
    localStorage.setItem(DELETED_CARDS_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage errors
  }
}

// Format next review time
export function formatNextReview(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// Human label for how long ago a video was watched, e.g. "Today" / "3 days ago".
// The backend sends Unix seconds, while a few cached frontend callers may
// already have milliseconds. Normalize both forms before comparing to Date.now.
export function relativeDay(trackedAt: number): string {
  const trackedAtMs = trackedAt < 100_000_000_000 ? trackedAt * 1000 : trackedAt;
  const days = Math.round((Date.now() - trackedAtMs) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

// Get responsive font size based on word/definition length
export function getWordFontSize(text: string): string {
  const len = text.length;
  if (len > 20) return 'text-lg md:text-xl';
  if (len > 15) return 'text-xl md:text-2xl';
  if (len > 12) return 'text-2xl md:text-3xl';
  if (len > 8) return 'text-3xl md:text-4xl';
  return 'text-4xl md:text-5xl';
}
