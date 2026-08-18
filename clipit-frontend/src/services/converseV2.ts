// API client for the Converse V2 prototype (isolated from the production chat).
import { API_BASE_URL } from '../config';
import { buildWsUrl } from '../lib/voiceSession';

const BASE = `${API_BASE_URL}/converse2`;

export const voiceWsUrl = (sessionId: number, language: string = 'es') =>
  buildWsUrl('/converse2/voice/ws', { session_id: sessionId, language });

export type Level = 'beginner' | 'intermediate' | 'advanced';
// Known reasons; a custom "Something else" reason is also allowed as free text.
export type KnownReason = 'travel' | 'work' | 'family' | 'partner' | 'show' | 'general';
export type Reason = KnownReason | (string & {});
export type EnglishSupport = 'lots' | 'some' | 'minimal';
export type SeedType = 'due_words' | 'video' | 'free' | 'topic';

export interface Profile {
  level: Level;
  reason: Reason;
  english_support: EnglishSupport;
}

export interface DueWord {
  lemma: string;
  gloss: string;
}

export interface MockVideo {
  video_id: string;
  title: string;
  channel: string;
  level: string;
}

export interface Correction {
  correct: string;
  why_en: string;
}

export interface SuggestedReply {
  es: string;
  en: string;
}

export interface TurnResult {
  turn_id: number;
  reply: string;
  reply_translation: string;
  detected_language: 'es' | 'en' | 'mixed';
  correction: Correction | null;
  used_target_words: string[];
  suggested_replies: SuggestedReply[];
}

export interface CreateSessionResult {
  session_id: number;
  level: Level;
  due_words: DueWord[];
  opening: { turn_id: number; reply: string; reply_translation: string };
}

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const getProfile = () => getJson<{ profile: Profile | null }>('/profile');

export const saveOnboarding = (req: Profile) =>
  postJson<{ profile: Profile }>('/onboarding', req);

export const listVideos = () => getJson<{ videos: MockVideo[] }>('/videos');

export const createSession = (req: {
  seed_type: SeedType;
  video_id?: string;
  seed_label?: string;
  language?: string;
  seed_words?: { lemma: string; gloss: string }[];
}) => postJson<CreateSessionResult>('/session', req);

export const sendTurn = (sessionId: number, text: string, language: string = 'es') =>
  postJson<TurnResult>(`/session/${sessionId}/turn`, { text, language });

export const regenerateTurn = (sessionId: number, language: string = 'ko') =>
  postJson<TurnResult>(`/session/${sessionId}/regenerate`, { language });

export const suggestReplies = (sessionId: number, language: string = 'ko') =>
  postJson<{ suggested_replies: SuggestedReply[] }>(`/session/${sessionId}/suggest`, { language });

export interface CoachResult {
  corrected: string;
  explanation: string;
  advanced_topic: string;
  advanced_detail: string;
}

export const coachEnglish = (sessionId: number, english: string, language: string = 'ko') =>
  postJson<CoachResult>(`/session/${sessionId}/coach`, { english, language });

export const getHint = (sessionId: number, language: string = 'es') =>
  postJson<{ hint_en: string }>(`/session/${sessionId}/hint?language=${encodeURIComponent(language)}`);

export const howDoISay = (sessionId: number, english: string, language: string = 'es') =>
  postJson<{ spanish: string; note_en: string }>(`/session/${sessionId}/how-do-i-say`, { english, language });

export const translate = async (text: string, language: string = 'es'): Promise<string> => {
  const { translation } = await postJson<{ translation: string }>('/translate', { text, language });
  return translation;
};

export const romanize = async (text: string, language: string = 'ko'): Promise<string> => {
  const { romanized } = await postJson<{ romanized: string }>('/romanize', { text, language });
  return romanized;
};

export const sessionFeedback = (sessionId: number, kind: 'too_easy' | 'too_hard') =>
  postJson<{ ok: boolean; difficulty_nudge: number }>(`/session/${sessionId}/session-feedback`, { kind });

export const correctionFeedback = (turnId: number, verdict: 'fine' | 'wrong') =>
  postJson<{ ok: boolean }>('/correction-feedback', { turn_id: turnId, verdict });
