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
  source_video_id?: string;
  source_video_title?: string;
}

export interface MixedSourceVideo {
  video_id: string;
  title: string;
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
  source_videos: MixedSourceVideo[];
  opening: { turn_id: number; reply: string; reply_translation: string };
}

async function postJson<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function getJson<T>(path: string, token?: string | null): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export const getProfile = () => getJson<{ profile: Profile | null }>('/profile');

export const saveOnboarding = (req: Profile) =>
  postJson<{ profile: Profile }>('/onboarding', req);

export const listVideos = () => getJson<{ videos: MockVideo[] }>('/videos');

export const createSession = (
  req: {
    seed_type: SeedType;
    video_id?: string;
    seed_label?: string;
    language?: string;
    seed_words?: { lemma: string; gloss: string }[];
  },
  token?: string | null,
) => postJson<CreateSessionResult>('/session', req, token);

export interface RecentSession {
  session_id: number;
  seed_type: SeedType;
  seed_label: string | null;
  seed_video_id: string | null;
  started_at: string;
  turn_count: number;
  last_line: string;
}

export const getRecentSession = (token: string) =>
  getJson<{ session: RecentSession | null }>('/sessions/recent', token);

export const getMixedSources = (language: string, token: string) =>
  getJson<{ word_count: number; max_words: number; videos: MixedSourceVideo[] }>(
    `/mixed-sources?language=${encodeURIComponent(language)}`,
    token,
  );

export interface ResumeTurn {
  turn_id: number;
  role: 'user' | 'assistant';
  text: string;
  reply_translation: string | null;
  correction: Correction | null;
  used_target_words: string[];
  suggested_replies: SuggestedReply[];
}

export interface ResumeResult {
  session_id: number;
  level: Level;
  seed_label: string | null;
  seed_video_id: string | null;
  due_words: DueWord[];
  turns: ResumeTurn[];
}

export const resumeSession = (sessionId: number, token: string) =>
  getJson<ResumeResult>(`/session/${sessionId}/resume`, token);

export const sendTurn = (sessionId: number, text: string, language: string = 'es', token?: string | null) =>
  postJson<TurnResult>(`/session/${sessionId}/turn`, { text, language }, token);

export const regenerateTurn = (sessionId: number, language: string = 'ko', token?: string | null) =>
  postJson<TurnResult>(`/session/${sessionId}/regenerate`, { language }, token);

export const suggestReplies = (sessionId: number, language: string = 'ko', token?: string | null) =>
  postJson<{ suggested_replies: SuggestedReply[] }>(`/session/${sessionId}/suggest`, { language }, token);

export interface CoachResult {
  corrected: string;
  explanation: string;
  advanced_topic: string;
  advanced_detail: string;
}

export const coachEnglish = (sessionId: number, english: string, language: string = 'ko', token?: string | null) =>
  postJson<CoachResult>(`/session/${sessionId}/coach`, { english, language }, token);

export const getHint = (sessionId: number, language: string = 'es', token?: string | null) =>
  postJson<{ hint_en: string }>(`/session/${sessionId}/hint?language=${encodeURIComponent(language)}`, undefined, token);

export const howDoISay = (sessionId: number, english: string, language: string = 'es', token?: string | null) =>
  postJson<{ spanish: string; note_en: string }>(`/session/${sessionId}/how-do-i-say`, { english, language }, token);

export const translate = async (text: string, language: string = 'es'): Promise<string> => {
  const { translation } = await postJson<{ translation: string }>('/translate', { text, language });
  return translation;
};

export const romanize = async (text: string, language: string = 'ko'): Promise<string> => {
  const { romanized } = await postJson<{ romanized: string }>('/romanize', { text, language });
  return romanized;
};

export const sessionFeedback = (sessionId: number, kind: 'too_easy' | 'too_hard', token?: string | null) =>
  postJson<{ ok: boolean; difficulty_nudge: number }>(`/session/${sessionId}/session-feedback`, { kind }, token);

// Attaches target words to a session after it's already started — used when
// the opening line was shown before word lookup finished, so the words can
// be filled in once ready instead of blocking the greeting on them.
export const setSessionTargetWords = (
  sessionId: number,
  words: { lemma: string; gloss: string }[],
  token?: string | null,
) => postJson<{ ok: boolean }>(`/session/${sessionId}/target-words`, { words }, token);

export const correctionFeedback = (turnId: number, verdict: 'fine' | 'wrong') =>
  postJson<{ ok: boolean }>('/correction-feedback', { turn_id: turnId, verdict });
