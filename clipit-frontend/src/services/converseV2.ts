// API client for the Converse V2 prototype (isolated from the production chat).
import { API_BASE_URL } from '../config';
import { buildWsUrl } from '../lib/voiceSession';

const BASE = `${API_BASE_URL}/converse2`;

// Voice runs on the production chat_voice.py relay (authenticated,
// ChatSession-backed), not converse2's own sandboxed /voice/ws — see
// createChatVoiceSession below for the session this URL's session_id refers to.
export const voiceWsUrl = (sessionId: number, token: string, voice?: string) =>
  buildWsUrl('/chat/voice/ws', { session_id: sessionId, token, ...(voice ? { voice } : {}) });

export interface ChatSessionResult {
  session_id: number;
  level: string;
  seed_type: string;
  seed_label: string | null;
  seed_video_id: string | null;
  mode: string;
  reason: string | null;
  english_support: string | null;
  started_at: string;
}

/** Create the ChatSession voice mode talks to. Separate from converse2's own
 * text-chat session (a different backend/model entirely) — level is left
 * unset so the backend derives it from the learner's actual FSRS data
 * instead of converse2's onboarding self-assessment, which uses a different
 * beginner/intermediate/advanced scale than chat_voice.py's CEFR levels. */
export async function createChatVoiceSession(
  params: {
    language: string;
    seed_label?: string | null;
    seed_video_id?: string | null;
    mode?: string | null;
    reason?: string | null;
    english_support?: string | null;
  },
  token: string,
): Promise<ChatSessionResult> {
  const res = await fetch(`${API_BASE_URL}/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      seed_type: params.seed_video_id ? 'video' : 'free',
      seed_video_id: params.seed_video_id || undefined,
      seed_label: params.seed_label || undefined,
      mode: params.mode || 'free',
      language: params.language,
      reason: params.reason || undefined,
      english_support: params.english_support || undefined,
    }),
  });
  if (!res.ok) throw new Error('Could not start voice session');
  return res.json();
}

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
  romanized: string;
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
  opening?: { turn_id: number; reply: string; reply_translation: string };
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

/** Re-synthesized audio for a persisted assistant turn, in the same voice
 * used for the live conversation — lets "Listen" match what was actually said. */
export async function getTurnAudioUrl(token: string | null, turnId: number, voice?: string): Promise<string> {
  const qs = voice ? `?voice=${encodeURIComponent(voice)}` : '';
  const res = await fetch(`${BASE}/turn/${turnId}/audio${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`turn audio failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
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
    stream_opening?: boolean;
  },
  token?: string | null,
) => postJson<CreateSessionResult>('/session', { ...req, stream_opening: true }, token);

export interface OpeningResult {
  turn_id: number;
  reply: string;
  reply_translation: string;
}

export interface StreamSpeech {
  text: string;
  /** Base64-encoded WAV audio generated in the selected AI voice. */
  audio: string;
}

export async function streamOpening(
  sessionId: number,
  language: string,
  token: string | null | undefined,
  onChunk: (piece: string) => void,
  onSpeech: (speech: StreamSpeech) => void = () => {},
  voice?: string,
): Promise<OpeningResult> {
  const res = await fetch(`${BASE}/session/${sessionId}/opening/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ language, voice }),
  });
  if (!res.ok || !res.body) throw new Error(`opening stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: OpeningResult | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const event = JSON.parse(line.slice(5).trim());
      if (event.type === 'chunk') onChunk(event.text as string);
      else if (event.type === 'speech') onSpeech({ text: event.text as string, audio: event.audio as string });
      else if (event.type === 'error') throw new Error(event.message || 'Opening stream failed');
      else if (event.type === 'done') {
        const { type: _type, ...opening } = event;
        result = opening as OpeningResult;
      }
    }
  }
  if (!result) throw new Error('Opening stream ended without a result');
  return result;
}

export interface RecentSession {
  session_id: number;
  seed_type: SeedType;
  seed_label: string | null;
  seed_video_id: string | null;
  started_at: string;
  turn_count: number;
  last_line: string;
  due_words: DueWord[];
}

export const getRecentSession = (token: string) =>
  getJson<{ session: RecentSession | null }>('/sessions/recent', token);

export const getMixedSources = (language: string, token: string) =>
  getJson<{ word_count: number; max_words: number; words?: string[]; videos: MixedSourceVideo[] }>(
    `/mixed-sources?language=${encodeURIComponent(language)}`,
    token,
  );

export interface ResumeTurn {
  turn_id: number;
  role: 'user' | 'assistant';
  text: string;
  reply_translation: string | null;
  romanized: string | null;
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

/** Same as sendTurn, but streams the reply as it's generated (SSE) instead
 * of waiting for the full response. onChunk fires with each piece of text
 * as it arrives; the returned promise resolves with the same shape as
 * sendTurn once the stream completes. */
export async function sendTurnStream(
  sessionId: number,
  text: string,
  language: string,
  token: string | null | undefined,
  onChunk: (piece: string) => void,
  onSpeech: (speech: StreamSpeech) => void = () => {},
  voice?: string,
): Promise<TurnResult> {
  const res = await fetch(`${BASE}/session/${sessionId}/turn/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, language, voice }),
  });
  if (!res.ok || !res.body) throw new Error(`turn stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: TurnResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr) continue;
      const event = JSON.parse(jsonStr);
      if (event.type === 'chunk') {
        onChunk(event.text as string);
      } else if (event.type === 'speech') {
        onSpeech({ text: event.text as string, audio: event.audio as string });
      } else if (event.type === 'error') {
        throw new Error(event.message || 'Stream failed');
      } else if (event.type === 'done') {
        const { type: _type, ...rest } = event;
        result = rest as TurnResult;
      }
    }
  }

  if (!result) throw new Error('Stream ended without a result');
  return result;
}

export const regenerateTurn = (sessionId: number, language: string = 'ko', token?: string | null, voice?: string) =>
  postJson<TurnResult>(`/session/${sessionId}/regenerate`, { language, voice }, token);

export const suggestReplies = (sessionId: number, language: string = 'ko', token?: string | null) =>
  postJson<{ suggested_replies: SuggestedReply[] }>(`/session/${sessionId}/suggest`, { language }, token);

/** Stream suggested replies as complete rows so the UI can reveal each option
 * when its target-language phrase and English support are ready. */
export async function suggestRepliesStream(
  sessionId: number,
  language: string,
  token: string | null | undefined,
  onSuggestion: (suggestion: SuggestedReply) => void,
  onDelta?: (text: string) => void,
): Promise<SuggestedReply[]> {
  const res = await fetch(`${BASE}/session/${sessionId}/suggest/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ language }),
  });
  if (!res.ok || !res.body) throw new Error(`suggest stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const received: SuggestedReply[] = [];
  const receivedKeys = new Set<string>();

  const receive = (suggestion: SuggestedReply) => {
    const key = `${suggestion.es}\u0000${suggestion.en ?? ''}`;
    if (!suggestion.es || receivedKeys.has(key)) return;
    receivedKeys.add(key);
    received.push(suggestion);
    onSuggestion(suggestion);
  };

  const handleEvent = (event: Record<string, unknown>) => {
    if (event.type === 'delta' && typeof event.text === 'string') {
      onDelta?.(event.text);
    } else if (event.type === 'suggestion' && event.suggestion && typeof event.suggestion === 'object') {
      receive(event.suggestion as SuggestedReply);
    } else if (event.type === 'done' && Array.isArray(event.suggested_replies)) {
      // The final payload makes choices resilient to proxies that coalesce
      // intermediate chunks before the browser receives them.
      for (const value of event.suggested_replies) {
        if (value && typeof value === 'object') receive(value as SuggestedReply);
      }
    } else if (event.type === 'error') {
      throw new Error(String(event.message || 'Suggestion stream failed'));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      handleEvent(JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith('data:')) {
    handleEvent(JSON.parse(tail.slice(5).trim()) as Record<string, unknown>);
  }

  return received;
}

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

// Word/phrase glosses repeat constantly in a conversation (the same common
// words come up over and over) — cache by (language, text) for the life of
// the tab so re-tapping something already looked up is instant instead of
// re-hitting the translation API every time.
const translationCache = new Map<string, Promise<string>>();

export const translate = async (text: string, language: string = 'es'): Promise<string> => {
  const key = `${language}:${text}`;
  const cached = translationCache.get(key);
  if (cached) return cached;
  const promise = postJson<{ translation: string }>('/translate', { text, language })
    .then(({ translation }) => translation)
    .catch((error) => {
      translationCache.delete(key);
      throw error;
    });
  translationCache.set(key, promise);
  return promise;
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
