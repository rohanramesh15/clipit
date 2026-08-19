export interface SubtitleWord {
  /** Surface form as it appears in the subtitle line. */
  surface: string;
  /** Dictionary form saved to the deck. Omitted when identical to the surface form. */
  lemma?: string;
  romanization?: string;
  meaning?: string;
}

/** One line of Korean dialogue used for the interactive hero demo. */
export const demoLine: SubtitleWord[] = [
  { surface: '우리는', lemma: '우리', romanization: 'u-ri', meaning: 'we, us' },
  { surface: '매일', romanization: 'mae-il', meaning: 'every day' },
  { surface: '새로운', lemma: '새롭다', romanization: 'sae-rop-da', meaning: 'to be new' },
  { surface: '단어를', lemma: '단어', romanization: 'dan-eo', meaning: 'word, vocabulary' },
  { surface: '배워요', lemma: '배우다', romanization: 'bae-u-da', meaning: 'to learn' },
];

export const demoLineTranslation = 'We learn new words every day.';

export interface LoopStage {
  step: string;
  title: string;
  description: string;
}

export const loopStages: LoopStage[] = [
  {
    step: '01',
    title: 'Watch as usual',
    description: 'Browse YouTube and Netflix like you always do. No lesson plan, no homework tab.',
  },
  {
    step: '02',
    title: 'Words captured',
    description:
      'The free ClipIt extension picks up new words automatically, with the line they came from.',
  },
  {
    step: '03',
    title: 'Practice & remember',
    description: 'They become cards you review, speak, and play with until they stick.',
  },
];

export interface PracticeMode {
  id: 'flashcards' | 'voice' | 'madlibs';
  title: string;
  description: string;
}

export const practiceModes: Record<PracticeMode['id'], PracticeMode> = {
  flashcards: {
    id: 'flashcards',
    title: 'Flash Cards',
    description: 'Spaced-repetition review, scheduled for the moment you’re about to forget.',
  },
  voice: {
    id: 'voice',
    title: 'Voice Chat',
    description: 'Talk with an AI tutor that weaves your due words into real conversation.',
  },
  madlibs: {
    id: 'madlibs',
    title: 'Mad Libs',
    description: 'Drop your words back into the sentences from the videos you watched.',
  },
};

export interface Language {
  id: 'korean' | 'ukrainian';
  english: string;
}

export const availableLanguages: Language[] = [
  { id: 'korean', english: 'Korean' },
  { id: 'ukrainian', english: 'Ukrainian' },
];
