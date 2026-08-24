import type { Correction, SuggestedReply } from '../services/converseV2';

export interface TargetWord {
  lemma: string;    // dictionary form (sent to the backend, shown on the pill)
  gloss: string;    // English meaning
  surface: string;  // the form as it appeared in the video (helps detect usage)
  clipLine?: string; // the sentence this word came from, if the source card had one
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  translation?: string;
  correction?: Correction | null;
  turnId?: number;
  suggestedReplies?: SuggestedReply[];
  targets?: string[];
}

export interface SavedWord {
  lemma: string;
  gloss: string;
}

export type { Correction, SuggestedReply };
