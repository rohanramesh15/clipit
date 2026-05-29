import { API_BASE_URL } from '../config';

export type SeedType = 'video' | 'scenario' | 'srs' | 'wildcard' | 'free';

export interface Suggestion {
  id: string;
  type: SeedType;
  label: string;
  seed_label: string;
  seed_video_id?: string | null;
}

export interface OffListLemma {
  lemma: string;
  surface: string;
  sentence: string;
}

export interface ChatSessionInfo {
  session_id: number;
  level: string;
  seed_type: string;
  seed_label?: string | null;
  seed_video_id?: string | null;
  mode?: string;
  started_at: string;
}

export interface SessionSummary {
  turn_count: number;
  user_turn_count: number;
  encountered_new_words: OffListLemma[];
  rubric: {
    feedback_note?: string;
    strengths?: string[];
    suggestions?: string[];
    production_level?: string;
  };
  proficiency?: ProficiencyScores;
}

export interface TurnEvents {
  onStart?: (e: { user_text: string; user_turn_id: number; turn_idx: number }) => void;
  onChunk?: (chunk: string) => void;
  onEnd?: (e: {
    assistant_turn_id: number;
    assistant_text: string;
    off_list_lemmas: OffListLemma[];
    latency_ms: number;
  }) => void;
  onError?: (msg: string) => void;
}

const authHeaders = (token: string | null) => {
  const h: Record<string, string> = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

export async function fetchSuggestions(
  token: string,
  motivation?: string | null,
  language?: string,
): Promise<Suggestion[]> {
  const url = new URL(`${API_BASE_URL}/chat/suggestions`);
  if (motivation) url.searchParams.set('motivation', motivation);
  if (language) url.searchParams.set('language', language);
  const res = await fetch(url.toString(), {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load suggestions');
  const data = await res.json();
  return data.suggestions || [];
}

export async function createSession(
  token: string,
  body: {
    seed_type: SeedType;
    seed_id?: string;
    seed_video_id?: string;
    seed_label?: string;
    level?: string;
    mode?: string;
    language?: string;
  },
): Promise<ChatSessionInfo> {
  const res = await fetch(`${API_BASE_URL}/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

/**
 * Stream a chat turn via SSE. Uses fetch + ReadableStream so we can send the
 * Authorization header (EventSource doesn't support headers).
 */
export async function streamTurn(
  token: string,
  sessionId: number,
  input: { text?: string; audio?: Blob; level?: string },
  events: TurnEvents,
  abortSignal?: AbortSignal,
): Promise<void> {
  const form = new FormData();
  if (input.text) form.set('text', input.text);
  if (input.level) form.set('level', input.level);
  if (input.audio) form.set('audio', input.audio, 'turn.webm');

  const res = await fetch(`${API_BASE_URL}/chat/${sessionId}/turn`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
    signal: abortSignal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Turn failed: ${res.status} ${text}`);
  }
  if (!res.body) throw new Error('No stream body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events separated by double newline
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const block of parts) {
      const lines = block.split('\n');
      let event = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) continue;
      let payload: any = {};
      try { payload = JSON.parse(data); } catch { /* ignore */ }
      if (event === 'turn_start') events.onStart?.(payload);
      else if (event === 'chunk') events.onChunk?.(payload.text || '');
      else if (event === 'turn_end') events.onEnd?.(payload);
      else if (event === 'error') events.onError?.(payload.message || 'Error');
    }
  }
}

export async function endSession(
  token: string,
  sessionId: number,
): Promise<{ session_id: number; ended_at: string; summary: SessionSummary }> {
  const res = await fetch(`${API_BASE_URL}/chat/${sessionId}/end`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to end session');
  return res.json();
}

export async function getTurnAudioUrl(
  token: string,
  turnId: number,
  voice?: string,
): Promise<string> {
  const qs = voice ? `?voice=${encodeURIComponent(voice)}` : '';
  const res = await fetch(`${API_BASE_URL}/chat/audio/${turnId}${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to get TTS audio');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}


export interface TtsVoice {
  id: string;
  label: string;
}

export async function fetchTtsVoices(token: string): Promise<TtsVoice[]> {
  const res = await fetch(`${API_BASE_URL}/chat/voices`, {
    headers: authHeaders(token),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.voices || [];
}


export async function translateToEnglish(
  token: string,
  text: string,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/chat/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('Translation failed');
  const data = await res.json();
  return data.translation || '';
}


export interface ProficiencyScores {
  language: string;
  recognition_score: number | null;
  recognition_label: string | null;
  production_score: number | null;
  production_label: string | null;
  session_count: number;
}

export async function fetchProficiency(token: string, language?: string): Promise<ProficiencyScores> {
  const qs = language ? `?language=${encodeURIComponent(language)}` : '';
  const res = await fetch(`${API_BASE_URL}/chat/proficiency${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load proficiency');
  return res.json();
}


export async function saveWord(
  token: string,
  body: {
    session_id: number;
    turn_id?: number;
    lemma: string;
    surface_form?: string;
    sentence?: string;
  },
): Promise<{ status: string; lemma: string; card_id: number; saved_id: number }> {
  const res = await fetch(`${API_BASE_URL}/chat/save-word`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save word');
  return res.json();
}
