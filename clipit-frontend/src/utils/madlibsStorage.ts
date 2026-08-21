// Local-only progress tracking for in-progress Mad Libs sessions, so a video
// can show a "Continue" card and resume mid-deck. Mad Libs has no backend
// session concept (unlike AI chat / flashcards), so this lives entirely in
// localStorage, keyed per language + video.

import type { MadlibItem } from '../services/madlibs';

export interface MadlibAnswer {
  chosen: string;
  correct: boolean;
}

export interface MadlibProgress {
  videoId: string;
  title: string;
  language: string;
  items: MadlibItem[];
  answers: MadlibAnswer[];
  updatedAt: number;
}

const STORAGE_KEY = 'clipit_madlib_progress';

function readAll(): Record<string, MadlibProgress> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, MadlibProgress>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage errors (private browsing, quota, etc).
  }
}

function progressKey(language: string, videoId: string): string {
  return `${language}:${videoId}`;
}

export function saveMadlibProgress(progress: MadlibProgress) {
  const all = readAll();
  all[progressKey(progress.language, progress.videoId)] = progress;
  writeAll(all);
}

export function clearMadlibProgress(language: string, videoId: string) {
  const all = readAll();
  delete all[progressKey(language, videoId)];
  writeAll(all);
}

// The single most recently touched, not-yet-finished session for this language.
export function getMostRecentMadlibProgress(language: string): MadlibProgress | null {
  const entries = Object.values(readAll()).filter(
    (p) => p.language === language && p.answers.length < p.items.length,
  );
  if (entries.length === 0) return null;
  return entries.reduce((latest, p) => (p.updatedAt > latest.updatedAt ? p : latest));
}
