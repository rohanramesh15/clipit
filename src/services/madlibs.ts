// Data layer for the Mad Libs (fill-in-the-blank) practice mode.
//
// Mad Libs reuses the SAME per-video data as Flash Cards: for a tracked video we
// load its extracted words + example sentences, then turn each into a cloze by
// blanking the word out of its real sentence and offering multiple choices.

import { API_BASE_URL } from '../config';

export interface MadlibItem {
  id: string;
  before: string;       // sentence text before the blank
  after: string;        // sentence text after the blank
  answer: string;       // the target-language word that fills the blank
  gloss: string;        // English meaning of the answer (optional hint)
  translation: string;  // full English translation of the sentence
  options: string[];    // 3–4 target-language choices, including the answer
}

export interface TrackedVideo {
  video_id: string;
  title: string;
  tracked_at: number;
  building?: boolean;
}

export interface FlashCard {
  target_word: string;
  dictionary_form: string;
  english: string;
  sentence: string | null;
  sentence_translation: string | null;
}

// ── Fetch the user's tracked videos for a language ────────────────────────────
export async function fetchTrackedVideos(
  language: string,
  token?: string | null,
): Promise<TrackedVideo[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/videos/history/filtered?lang=${language}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos || [];
  } catch {
    return [];
  }
}

// ── Fetch the extracted words + example sentences for one video ───────────────
// Mirrors the Flash Cards loader (subtitles → vocabulary → flashcard-data).
export async function fetchVideoCards(videoId: string, language: string): Promise<FlashCard[]> {
  try {
    // Ensure subtitles are processed (best-effort).
    await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`).catch(() => {});

    const vocabRes = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=30&lang=${language}`);
    if (!vocabRes.ok) return [];
    const vocab = await vocabRes.json();
    if (!vocab.total_words) return [];

    const wordList = (vocab.vocabulary || []).map((v: { word: string }) => v.word);
    if (wordList.length === 0) return [];

    const fcRes = await fetch(`${API_BASE_URL}/flashcard-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, words: wordList, word_source: 'essential', language }),
    });
    if (!fcRes.ok) return [];
    const fc = await fcRes.json();
    return (fc.flashcards || []) as FlashCard[];
  } catch {
    return [];
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Turn flashcards into cloze (fill-the-blank) items ─────────────────────────
// For each card we locate the word inside its sentence and blank it; other words
// from the same video become distractor options.
export function buildMadlibItems(cards: FlashCard[], max = 12): MadlibItem[] {
  const allWords = Array.from(
    new Set(cards.map((c) => (c.target_word || '').trim()).filter(Boolean)),
  );

  const items: MadlibItem[] = [];
  for (const card of cards) {
    const sentence = (card.sentence || '').trim();
    const word = (card.target_word || '').trim();
    if (!sentence || !word) continue;

    const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
    if (idx === -1) continue; // word not literally in the sentence — can't blank it

    const matched = sentence.slice(idx, idx + word.length);
    const before = sentence.slice(0, idx);
    const after = sentence.slice(idx + word.length);

    const distractors = shuffle(
      allWords.filter((w) => w.toLowerCase() !== word.toLowerCase()),
    ).slice(0, 3);
    if (distractors.length === 0) continue; // need at least one alternative

    items.push({
      id: `${card.dictionary_form || word}-${items.length}`,
      before,
      after,
      answer: matched,
      gloss: card.english || '',
      translation: card.sentence_translation || '',
      options: shuffle([matched, ...distractors]),
    });
    if (items.length >= max) break;
  }

  return shuffle(items);
}
