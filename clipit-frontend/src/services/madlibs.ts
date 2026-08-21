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

export interface MadlibDeckStreamOptions {
  limit?: number;
  token?: string | null;
  signal?: AbortSignal;
  onCard: (card: FlashCard) => void;
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

// ── Lightweight: how many practiceable words a video has (for deck badges) ────
export async function fetchVideoWordCount(videoId: string, language: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=1&lang=${language}`);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total_words || 0;
  } catch {
    return 0;
  }
}

// ── Fetch the extracted words + example sentences for one video ───────────────
// Mirrors the Flash Cards loader (subtitles → vocabulary → flashcard-data).
// `limit` controls how many candidate words are fetched and translated —
// callers that only keep a handful (e.g. AI chat keeps 8) should pass a
// smaller number so the backend isn't translating words that get discarded.
// Mad Libs needs more headroom since it filters out words that don't
// literally appear in their sentence, so it keeps the default of 30.
export async function fetchVideoCards(videoId: string, language: string, limit = 30): Promise<FlashCard[]> {
  try {
    // Ensure subtitles are processed (best-effort).
    await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`).catch(() => {});

    const vocabRes = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=${limit}&lang=${language}`);
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

// Stream cards as the backend finishes them. This lets practice begin with the
// first usable cloze rather than waiting for every translation in the deck.
export async function streamVideoCards(
  videoId: string,
  language: string,
  { limit = 30, token, signal, onCard }: MadlibDeckStreamOptions,
): Promise<FlashCard[]> {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  await fetch(`${API_BASE_URL}/subtitles/${videoId}?lang=${language}`, { headers, signal });

  const vocabRes = await fetch(`${API_BASE_URL}/vocabulary/${videoId}?limit=${limit}&lang=${language}`, { headers, signal });
  if (!vocabRes.ok) throw new Error('Unable to load vocabulary');
  const vocab = await vocabRes.json();
  if (!vocab.total_words || !Array.isArray(vocab.vocabulary)) return [];

  const response = await fetch(`${API_BASE_URL}/flashcard-data/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...Object.fromEntries(headers) },
    signal,
    body: JSON.stringify({
      video_id: videoId,
      words: vocab.vocabulary.map((word: { word: string }) => word.word),
      word_source: 'essential',
      language,
    }),
  });
  if (!response.ok || !response.body) throw new Error('Flashcard stream unavailable');

  const cards: FlashCard[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleEvent = (rawEvent: string) => {
    const lines = rawEvent.split('\n');
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
    if (type === 'error') throw new Error(JSON.parse(data || '{}').detail || 'Unable to generate flashcards');
    if (type !== 'card' || !data) return;

    const card = JSON.parse(data) as FlashCard;
    cards.push(card);
    onCard(card);
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      handleEvent(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
  if (buffer.trim()) handleEvent(buffer);
  return cards;
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
export function buildMadlibItem(card: FlashCard, cards: FlashCard[], id: string): MadlibItem | null {
  const allWords = Array.from(
    new Set(cards.map((c) => (c.target_word || '').trim()).filter(Boolean)),
  );
  const sentence = (card.sentence || '').trim();
  const word = (card.target_word || '').trim();
  if (!sentence || !word) return null;

  const idx = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (idx === -1) return null; // word not literally in the sentence — can't blank it

  const matched = sentence.slice(idx, idx + word.length);
  const distractors = shuffle(
    allWords.filter((candidate) => candidate.toLowerCase() !== word.toLowerCase()),
  ).slice(0, 3);
  if (distractors.length === 0) return null; // need at least one alternative

  return {
    id,
    before: sentence.slice(0, idx),
    after: sentence.slice(idx + word.length),
    answer: matched,
    gloss: card.english || '',
    translation: card.sentence_translation || '',
    options: shuffle([matched, ...distractors]),
  };
}

export function buildMadlibItems(cards: FlashCard[], max = 12): MadlibItem[] {
  const items = cards.flatMap((card, index) => {
    const item = buildMadlibItem(card, cards, `${card.dictionary_form || card.target_word}-${index}`);
    return item ? [item] : [];
  }).slice(0, max);
  return shuffle(items);
}
