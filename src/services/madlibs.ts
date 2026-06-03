// Data layer for the Madlibs (fill-in-the-blank) practice mode.
//
// Madlibs is the written counterpart to Converse: it weaves the learner's
// spaced-repetition words into short, living sentences with one word removed,
// and — once the due set is exhausted — keeps going with the next words by
// priority so the user can always keep practicing.
//
// Backend contract (to implement): POST /converse2/madlibs
//   request:  { language: string, count: number }
//   response: { items: MadlibItem[] }
// Until that endpoint exists this module returns a clearly-labelled SAMPLE
// round (isSample: true) so the feature is fully usable and reviewable.

import { API_BASE_URL } from '../config';

export interface MadlibItem {
  id: string;
  before: string;       // sentence text before the blank
  after: string;        // sentence text after the blank
  answer: string;       // the target-language word that fills the blank
  gloss: string;        // English meaning of the answer (used as an optional hint)
  translation: string;  // full English translation of the completed sentence
  options: string[];    // 3–4 target-language choices, including the answer
  isSample?: boolean;   // true when served from the local fallback set
}

// A small, hand-authored Spanish set so the mode works end-to-end before the
// backend endpoint lands. Each item mirrors the real MadlibItem shape.
const SAMPLE_ES: Omit<MadlibItem, 'isSample'>[] = [
  {
    id: 's1',
    before: 'Todos los días ',
    after: ' café por la mañana.',
    answer: 'tomo',
    gloss: 'I drink / take',
    translation: 'Every day I drink coffee in the morning.',
    options: ['tomo', 'como', 'vivo', 'hablo'],
  },
  {
    id: 's2',
    before: 'Mi hermana ',
    after: ' en una oficina grande.',
    answer: 'trabaja',
    gloss: 'works',
    translation: 'My sister works in a big office.',
    options: ['trabaja', 'camina', 'duerme', 'lee'],
  },
  {
    id: 's3',
    before: '¿Puedes ',
    after: ' más despacio, por favor?',
    answer: 'hablar',
    gloss: 'to speak',
    translation: 'Can you speak more slowly, please?',
    options: ['hablar', 'comer', 'correr', 'abrir'],
  },
  {
    id: 's4',
    before: 'Ayer ',
    after: ' una película muy buena.',
    answer: 'vi',
    gloss: 'I saw',
    translation: 'Yesterday I saw a very good movie.',
    options: ['vi', 'fui', 'comí', 'leí'],
  },
  {
    id: 's5',
    before: 'Necesito ',
    after: ' al supermercado hoy.',
    answer: 'ir',
    gloss: 'to go',
    translation: 'I need to go to the supermarket today.',
    options: ['ir', 'ver', 'dar', 'ser'],
  },
  {
    id: 's6',
    before: 'Nosotros ',
    after: ' en la playa todo el verano.',
    answer: 'estuvimos',
    gloss: 'we were',
    translation: 'We were at the beach all summer.',
    options: ['estuvimos', 'fuimos', 'tenemos', 'vamos'],
  },
];

function sampleItems(language: string): MadlibItem[] {
  // Only Spanish sample content exists; other languages fall through to the
  // empty state until the backend endpoint provides localized items.
  if (language !== 'es') return [];
  return SAMPLE_ES.map((it) => ({ ...it, isSample: true }));
}

export async function fetchMadlibItems(
  language: string,
  count = 8,
): Promise<MadlibItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/converse2/madlibs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, count }),
    });
    if (!res.ok) throw new Error(`madlibs failed: ${res.status}`);
    const data: { items?: MadlibItem[] } = await res.json();
    if (data.items && data.items.length > 0) return data.items;
    return sampleItems(language);
  } catch {
    // Network/endpoint not available yet → labelled sample round.
    return sampleItems(language);
  }
}
