export interface FlashCard {
  target_word: string;
  dictionary_form: string;
  english: string;
  sentence: string | null;
  sentence_translation: string | null;
  timestamp: number | null;
  end_timestamp: number | null;
  video_id: string | null;
  rank?: number;
  card_type?: 'tts' | 'video';
}

export interface TrackedVideo {
  video_id: string;
  title: string;
  tracked_at: number;
  season?: number | null;
  episode?: number | null;
  episode_title?: string | null;
  building?: boolean; // True if ClipIt is still building this deck
}

export type LoadState =
  | 'loading'
  | 'deck-select'
  | 'loaded'
  | 'error'
  | 'no-vocab'
  | 'session-complete'
  | 'time-gated-complete';

export type Page =
  | 'video'
  | 'practice'
  | 'flashcards'
  | 'analytics'
  | 'vocabulary'
  | 'converse-v2'
  | 'madlibs'
  | 'settings';
