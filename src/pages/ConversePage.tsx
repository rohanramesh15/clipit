import { useEffect, useRef, useState } from 'react';
import {
  Construction,
  Sparkles,
  X,
  Loader2,
  Plus,
  Languages,
  Mic,
  Volume2,
  Film,
  Coffee,
  GraduationCap,
  Wand2,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Suggestion,
  ChatSessionInfo,
  OffListLemma,
  SessionSummary,
  ProficiencyScores,
  fetchSuggestions,
  createSession,
  streamTurn,
  endSession,
  saveWord,
  getTurnAudioUrl,
  translateToEnglish,
  fetchProficiency,
} from '../services/chat';

type Msg = {
  id: string;
  turnId?: number;
  role: 'user' | 'assistant';
  text: string;
  offList?: OffListLemma[];
  isStreaming?: boolean;
  showTranslation?: boolean;
  translation?: string;
  translationLoading?: boolean;
  audioUrl?: string;
  audioLoading?: boolean;
};

const LEVELS = ['A1', 'A2', 'B1'] as const;
type Level = (typeof LEVELS)[number];

type Mode = 'free' | 'debate' | 'interview' | 'roleplay' | 'shadowing';
const MODES: { id: Mode; label: string; emoji: string; hint: string }[] = [
  { id: 'free',       label: 'Chat',       emoji: '💬', hint: 'Natural conversation' },
  { id: 'interview',  label: 'Interview',  emoji: '🎙️', hint: 'AI asks, you talk' },
  { id: 'debate',     label: 'Debate',     emoji: '🥊', hint: 'Take opposite sides' },
  { id: 'roleplay',   label: 'Role-play',  emoji: '🎭', hint: 'Stay in character' },
  { id: 'shadowing',  label: 'Shadowing',  emoji: '🔁', hint: 'Repeat after the AI' },
];

// YouTube thumbnail URL helper. Skips fake/Netflix IDs that won't resolve.
function videoThumbUrl(videoId: string): string | null {
  if (!videoId) return null;
  if (videoId.startsWith('netflix_') || videoId.startsWith('fixture_')) return null;
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

// Always return 3 cards. Prefer 1 video + 1 scenario + 1 wildcard.
// Falls back gracefully if a category is missing.
function pickThreeCards(all: Suggestion[]): Suggestion[] {
  const video = all.find((s) => s.type === 'video');
  const scenario = all.find((s) => s.type === 'scenario');
  const wildcard = all.find((s) => s.type === 'wildcard');
  const srs = all.find((s) => s.type === 'srs');
  const picked = [video, scenario, wildcard, srs].filter((s): s is Suggestion => Boolean(s));
  // Top up if we still have <3 (rare)
  for (const s of all) {
    if (picked.length >= 3) break;
    if (!picked.includes(s)) picked.push(s);
  }
  return picked.slice(0, 3);
}

// Vibrant gradient palette per suggestion type
const CARD_STYLES: Record<string, { gradient: string; icon: any; accent: string }> = {
  video: {
    gradient: 'from-fuchsia-500 via-purple-600 to-indigo-700',
    icon: Film,
    accent: 'shadow-fuchsia-500/40',
  },
  scenario: {
    gradient: 'from-orange-400 via-rose-500 to-red-600',
    icon: Coffee,
    accent: 'shadow-rose-500/40',
  },
  srs: {
    gradient: 'from-cyan-400 via-sky-500 to-blue-600',
    icon: GraduationCap,
    accent: 'shadow-sky-500/40',
  },
  wildcard: {
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    icon: Wand2,
    accent: 'shadow-teal-500/40',
  },
};

const SUPPORTED_CHAT_LANGUAGES = new Set(['es', 'en']);

export function ConversePage() {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();

  // Gate non-supported languages
  if (!SUPPORTED_CHAT_LANGUAGES.has(language)) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6">
          <Construction className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-primary mb-3">
          Conversation isn't available for {languageName} yet
        </h1>
        <p className="text-secondary max-w-md leading-relaxed">
          We're working to add it soon. In the meantime, switch your learning language
          to Spanish or English from the sidebar to try out the conversation feature.
        </p>
      </div>
    );
  }

  return <SpanishConverse token={token} language={language} languageName={languageName} />;
}

// Language-specific copy. `hi` takes the user's first name (or null) so we can
// render "¡Hola, Rohan!" or "Hi, Rohan!" when we know who they are.
const GREETINGS: Record<string, {
  hi: (firstName: string | null) => string;
  prompt: string;
  placeholder: string;
  opener: (label: string) => string;
  resume: (label: string) => string;
}> = {
  es: {
    hi: (n) => (n ? `¡Hola, ${n}!` : '¡Hola!'),
    prompt: '¿De qué quieres hablar hoy?',
    placeholder: 'Hold to speak in Spanish',
    opener: (label) => `Vamos a hablar sobre ${label}.`,
    resume: (label) => `Sigamos hablando sobre ${label}.`,
  },
  en: {
    hi: (n) => (n ? `Hi, ${n}!` : 'Hi there!'),
    prompt: 'What do you want to talk about today?',
    placeholder: 'Hold to speak in English',
    opener: (label) => `Let's talk about ${label}.`,
    resume: (label) => `Let's keep talking about ${label}.`,
  },
};

function getFirstName(fullName: string | null | undefined, email: string | null | undefined): string | null {
  const name = (fullName || '').trim();
  if (name) {
    const first = name.split(/\s+/)[0];
    if (first) return first;
  }
  // Fall back to email local-part if it looks like a name (no digits/symbols)
  const local = (email || '').split('@')[0];
  if (local && /^[a-zA-Z]+$/.test(local)) {
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return null;
}

function SpanishConverse({ token, language, languageName }: { token: string | null; language: string; languageName: string }) {
  const { user } = useAuth();
  const copy = GREETINGS[language] || GREETINGS.es;
  const firstName = getFirstName(user?.full_name, user?.email);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [proficiency, setProficiency] = useState<ProficiencyScores | null>(null);
  const [session, setSession] = useState<ChatSessionInfo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [level, setLevel] = useState<Level>('A2');
  const [mode, setMode] = useState<Mode>('free');
  const [savedLemmas, setSavedLemmas] = useState<Set<string>>(new Set());
  const [savingLemmas, setSavingLemmas] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(12).fill(0));
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);

  // When the user switches their learning language, fully reset the chat
  // surface — otherwise an active session stays in the old language and the
  // AI keeps replying in Spanish even though the sidebar now says English.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setSession(null);
    setMessages([]);
    setSummary(null);
    setSavedLemmas(new Set());
    setError(null);
    setLoadingSuggestions(true);
    setSuggestions([]);
    setProficiency(null);
    const motivation = localStorage.getItem('user_motivation');
    fetchSuggestions(token, motivation, language)
      .then((s) => { if (!cancelled) setSuggestions(s); })
      .catch(() => { if (!cancelled) setSuggestions([]); })
      .finally(() => { if (!cancelled) setLoadingSuggestions(false); });
    fetchProficiency(token, language)
      .then((p) => { if (!cancelled) setProficiency(p); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [token, language]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  const ensureSession = async (): Promise<ChatSessionInfo> => {
    if (session) return session;
    if (!token) throw new Error('Not authenticated');
    const s = await createSession(token, { seed_type: 'free', level, mode, language });
    setSession(s);
    setLevel((s.level as Level) || level);
    return s;
  };

  const sendTurnWithSession = async (s: ChatSessionInfo, text: string) => {
    setError(null);
    const userMsgId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text }]);
    const asstMsgId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: asstMsgId, role: 'assistant', text: '', isStreaming: true }]);
    setStreaming(true);
    try {
      await streamTurn(
        token!,
        s.session_id,
        { text, level },
        {
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === asstMsgId ? { ...m, text: m.text + chunk } : m)),
            );
          },
          onEnd: (e) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsgId
                  ? {
                      ...m,
                      text: e.assistant_text || m.text,
                      offList: e.off_list_lemmas,
                      turnId: e.assistant_turn_id,
                      isStreaming: false,
                    }
                  : m,
              ),
            );
            // Voice-only: auto-play every AI reply
            if (e.assistant_turn_id) {
              setTimeout(() => {
                onPlayAudio({
                  id: asstMsgId,
                  role: 'assistant',
                  text: e.assistant_text || '',
                  turnId: e.assistant_turn_id,
                });
              }, 100);
            }
          },
          onError: (msg) => {
            setError(msg);
            setMessages((prev) => prev.filter((m) => m.id !== asstMsgId));
          },
        },
      );
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
      setMessages((prev) => prev.filter((m) => m.id !== asstMsgId));
    } finally {
      setStreaming(false);
    }
  };

  const onCardTap = async (sug: Suggestion) => {
    if (!token || streaming) return;
    try {
      const s = await createSession(token, {
        seed_type: sug.type === 'free' ? 'free' : sug.type,
        seed_id: sug.id,
        seed_video_id: sug.seed_video_id || undefined,
        seed_label: sug.seed_label,
        level,
        mode,
        language,
      });
      setSession(s);
      setLevel((s.level as Level) || level);
      const opener = copy.opener(sug.seed_label);
      await sendTurnWithSession(s, opener);
    } catch (e: any) {
      setError(e?.message || 'Failed to start');
    }
  };

  const onToggleTranslation = async (msg: Msg) => {
    // If we already have a translation cached, just toggle visibility
    if (msg.translation) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, showTranslation: !m.showTranslation } : m,
        ),
      );
      return;
    }
    if (!token) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msg.id ? { ...m, translationLoading: true, showTranslation: true } : m,
      ),
    );
    try {
      const english = await translateToEnglish(token, msg.text);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, translation: english, translationLoading: false }
            : m,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, translationLoading: false, translation: '(translation unavailable)' }
            : m,
        ),
      );
    }
  };

  const onPlayAudio = async (msg: Msg) => {
    if (!token || !msg.turnId) return;
    if (msg.audioUrl) {
      new Audio(msg.audioUrl).play().catch(() => {});
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, audioLoading: true } : m)),
    );
    try {
      const voice = localStorage.getItem('tts_voice') || 'Kore';
      const url = await getTurnAudioUrl(token, msg.turnId, voice);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, audioUrl: url, audioLoading: false } : m,
        ),
      );
      new Audio(url).play().catch(() => {});
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, audioLoading: false } : m)),
      );
      setError('Audio playback failed. Try again.');
    }
  };

  const startRecording = async () => {
    if (recording || streaming) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        // Stop waveform animation + release audio context
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
          analyserRef.current = null;
        }
        setAudioLevels(new Array(12).fill(0));
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size > 200) await sendAudioTurn(blob);
      };
      recorder.start();
      recorderRef.current = recorder;

      // ── Live waveform via Web Audio API ─────────────────────────────
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins; cheap and smooth
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const bars = 12;
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        // Average the spectrum into N visual bars
        const out: number[] = [];
        const chunkSize = Math.floor(dataArray.length / bars);
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < chunkSize; j++) sum += dataArray[i * chunkSize + j];
          out.push(Math.min(1, sum / (chunkSize * 255) * 2.5)); // 0..1, mild gain
        }
        setAudioLevels(out);
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      animationFrameRef.current = requestAnimationFrame(tick);

      setRecording(true);
    } catch {
      setError('Microphone permission denied');
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    setRecording(false);
    recorderRef.current?.stop();
  };

  const sendAudioTurn = async (blob: Blob) => {
    if (!token) return;
    setTranscribing(true);
    setStreaming(true);

    const userMsgId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: '🎤 …' }]);
    const asstMsgId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: asstMsgId, role: 'assistant', text: '', isStreaming: true }]);

    try {
      const s = await ensureSession();
      await streamTurn(
        token,
        s.session_id,
        { audio: blob, level },
        {
          onStart: (e) => {
            setTranscribing(false);
            setMessages((prev) =>
              prev.map((m) => (m.id === userMsgId ? { ...m, text: e.user_text } : m)),
            );
          },
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === asstMsgId ? { ...m, text: m.text + chunk } : m)),
            );
          },
          onEnd: (e) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === asstMsgId
                  ? {
                      ...m,
                      text: e.assistant_text || m.text,
                      offList: e.off_list_lemmas,
                      turnId: e.assistant_turn_id,
                      isStreaming: false,
                    }
                  : m,
              ),
            );
            // Auto-play TTS for voice replies
            if (e.assistant_turn_id) {
              setTimeout(() => {
                onPlayAudio({
                  id: asstMsgId,
                  role: 'assistant',
                  text: e.assistant_text || '',
                  turnId: e.assistant_turn_id,
                });
              }, 100);
            }
          },
          onError: (msg) => {
            setError(msg);
            setMessages((prev) => prev.filter((m) => m.id !== asstMsgId));
          },
        },
      );
    } catch (e: any) {
      setError(e?.message || 'Voice turn failed');
      setMessages((prev) => prev.filter((m) => m.id !== userMsgId && m.id !== asstMsgId));
    } finally {
      setTranscribing(false);
      setStreaming(false);
    }
  };

  const onSaveWord = async (chip: OffListLemma, turnId?: number) => {
    if (!token || !session) return;
    const lemma = chip.lemma;
    if (savedLemmas.has(lemma) || savingLemmas.has(lemma)) return;
    setSavingLemmas((prev) => new Set(prev).add(lemma));
    try {
      await saveWord(token, {
        session_id: session.session_id,
        turn_id: turnId,
        lemma,
        surface_form: chip.surface,
        sentence: chip.sentence,
      });
      setSavedLemmas((prev) => new Set(prev).add(lemma));
    } catch { /* silent */ } finally {
      setSavingLemmas((prev) => {
        const next = new Set(prev);
        next.delete(lemma);
        return next;
      });
    }
  };

  const onEnd = async () => {
    if (!token || !session || ending) return;
    setEnding(true);
    try {
      const r = await endSession(token, session.session_id);
      setSummary(r.summary);
    } catch (e: any) {
      setError(e?.message || 'Failed to end session');
    } finally {
      setEnding(false);
    }
  };

  const resetChat = () => {
    setSession(null);
    setMessages([]);
    setSummary(null);
    setSavedLemmas(new Set());
    setError(null);
    if (token) {
      setLoadingSuggestions(true);
      const motivation = localStorage.getItem('user_motivation');
      fetchSuggestions(token, motivation, language)
        .then(setSuggestions)
        .finally(() => setLoadingSuggestions(false));
      fetchProficiency(token, language).then(setProficiency).catch(() => {});
    }
  };

  // ── Empty state: vibrant suggestion cards ────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="px-2 pt-2 mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary">
              {copy.hi(firstName)}
            </h1>
            <p className="text-secondary mt-1">{copy.prompt}</p>
          </div>
          <LevelDial value={level} onChange={setLevel} />
        </div>

        {/* Proficiency split — only when there's data to show */}
        {proficiency && (proficiency.recognition_label || proficiency.production_label) && (
          <div className="px-2 mb-6">
            <ProficiencyStrip p={proficiency} />
          </div>
        )}

        {/* Mode picker */}
        <div className="px-2 mb-6">
          <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-2">
            Mode
          </p>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.hint}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  mode === m.id
                    ? 'bg-accent/10 border-accent text-primary'
                    : 'bg-surface/50 border-white/10 text-secondary hover:text-primary'
                }`}>
                <span className="mr-1.5">{m.emoji}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Vibrant suggestion cards */}
        <div className="flex-1 px-2">
          {loadingSuggestions ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-40 rounded-3xl bg-white/5 animate-pulse"
                />
              ))}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm">
              No suggestions yet. Tap the mic below or type to start talking.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pickThreeCards(suggestions).map((s) => {
                const style = CARD_STYLES[s.type] || CARD_STYLES.wildcard;
                const Icon = style.icon;
                const thumb = s.type === 'video' && s.seed_video_id
                  ? videoThumbUrl(s.seed_video_id)
                  : null;
                return (
                  <button
                    key={s.id}
                    onClick={() => onCardTap(s)}
                    disabled={streaming}
                    className={`group relative overflow-hidden rounded-3xl text-left shadow-lg ${style.accent} hover:scale-[1.02] hover:shadow-2xl transition-all duration-300 disabled:opacity-50 min-h-[200px] bg-gradient-to-br ${style.gradient}`}>
                    {/* Video thumbnail layer (only for video cards) */}
                    {thumb && (
                      <>
                        <img
                          src={thumb}
                          alt=""
                          onError={(e) => { (e.currentTarget.style.display = 'none'); }}
                          className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                      </>
                    )}

                    {/* Decorative blobs (only if no thumbnail) */}
                    {!thumb && (
                      <>
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-black/20 rounded-full blur-3xl" />
                      </>
                    )}

                    {/* Content — inline color: 'white' so the .light theme
                         override doesn't swap it to dark and kill contrast */}
                    <div className="relative h-full p-5 flex flex-col justify-end">
                      <div
                        className="w-11 h-11 rounded-2xl backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg"
                        style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}>
                        <Icon className="w-5 h-5" style={{ color: 'white' }} />
                      </div>
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest mb-1"
                        style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {s.type === 'video' ? 'From your watch history' :
                         s.type === 'scenario' ? 'Scenario' :
                         s.type === 'srs' ? 'Practice words' :
                         'Free chat'}
                      </p>
                      <p
                        className="text-base md:text-lg font-bold leading-snug"
                        style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
                        {s.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom: prominent mic, the only way to start */}
        <div className="mt-8 px-2 pb-6 flex flex-col items-center gap-3">
          <Waveform levels={audioLevels} active={recording} />
          <MicButton
            recording={recording}
            transcribing={transcribing}
            onStart={startRecording}
            onStop={stopRecording}
            large
          />
          <p className="text-xs text-muted">
            {recording ? 'Listening…' : copy.placeholder}
          </p>
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Active conversation: voice-first minimalist UI ──────────────────────────
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Top bar: back, level, end */}
      <div className="flex items-center justify-between px-2 mb-4">
        <button
          onClick={resetChat}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          New chat
        </button>
        <div className="flex items-center gap-2">
          <LevelDial value={level} onChange={setLevel} />
          <button
            onClick={onEnd}
            disabled={ending}
            className="text-xs font-medium text-secondary hover:text-primary border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/5 transition-colors disabled:opacity-50">
            {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'End'}
          </button>
        </div>
      </div>

      {/* Conversation area — clean, lots of space */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-2 py-6 space-y-6">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            onSaveWord={onSaveWord}
            savedLemmas={savedLemmas}
            savingLemmas={savingLemmas}
            onPlayAudio={() => onPlayAudio(m)}
            onToggleTranslation={() => onToggleTranslation(m)}
          />
        ))}
      </div>

      {/* Bottom: voice-only mic dock */}
      <div className="border-t border-white/5 bg-app/80 backdrop-blur-md pt-5 pb-4 px-2 flex flex-col items-center gap-2">
        <Waveform levels={audioLevels} active={recording} />
        <MicButton
          recording={recording}
          transcribing={transcribing}
          onStart={startRecording}
          onStop={stopRecording}
          disabled={streaming && !recording}
          large
        />
        <p className="text-xs text-muted">
          {recording ? 'Listening…' : transcribing ? 'Transcribing…' : streaming ? 'AI is replying…' : 'Hold to speak'}
        </p>
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>

      {/* End-of-session summary */}
      {summary && (
        <SessionSummaryModal
          summary={summary}
          token={token}
          sessionId={session?.session_id}
          savedLemmas={savedLemmas}
          onSaveAll={async (lemmas) => {
            if (!token || !session) return;
            const remaining = lemmas.filter((l) => !savedLemmas.has(l.lemma));
            for (const l of remaining) {
              try {
                await saveWord(token, {
                  session_id: session.session_id,
                  lemma: l.lemma,
                  surface_form: l.surface,
                  sentence: l.sentence,
                });
                setSavedLemmas((prev) => new Set(prev).add(l.lemma));
              } catch { /* ignore */ }
            }
          }}
          onTalkAgain={async () => {
            // Re-seed a new session with the same topic
            if (!token || !session) return;
            const seedType = session.seed_type as Suggestion['type'];
            const seedLabel = session.seed_label || 'the same topic';
            const seedVideoId = session.seed_video_id || undefined;
            // Clear summary + messages but keep seed context
            setSummary(null);
            setMessages([]);
            setSavedLemmas(new Set());
            try {
              const s = await createSession(token, {
                seed_type: seedType === 'free' ? 'free' : seedType,
                seed_video_id: seedVideoId,
                seed_label: seedLabel,
                level,
                language,
              });
              setSession(s);
              setLevel((s.level as Level) || level);
              await sendTurnWithSession(s, copy.resume(seedLabel));
            } catch (e: any) {
              setError(e?.message || 'Could not restart');
            }
          }}
          onClose={resetChat}
        />
      )}
    </div>
  );
}

function Waveform({ levels, active }: { levels: number[]; active: boolean }) {
  return (
    <div
      className={`h-8 flex items-end justify-center gap-1 transition-opacity ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden>
      {levels.map((lvl, i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-red-500"
          style={{
            height: `${Math.max(4, lvl * 32)}px`,
            transition: 'height 80ms ease-out',
          }}
        />
      ))}
    </div>
  );
}

const LANGUAGE_LABEL: Record<string, string> = {
  es: 'Spanish',
  en: 'English',
  ko: 'Korean',
  uk: 'Ukrainian',
};

function ProficiencyStrip({ p }: { p: ProficiencyScores }) {
  const cefr = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const recIdx = p.recognition_label ? cefr.indexOf(p.recognition_label) : -1;
  const prodIdx = p.production_label ? cefr.indexOf(p.production_label) : -1;
  const recPct = recIdx >= 0 ? ((recIdx + 1) / cefr.length) * 100 : 0;
  const prodPct = prodIdx >= 0 ? ((prodIdx + 1) / cefr.length) * 100 : 0;
  const gap = recIdx >= 0 && prodIdx >= 0 ? recIdx - prodIdx : 0;
  const langLabel = LANGUAGE_LABEL[p.language] || p.language.toUpperCase();
  return (
    <div className="bg-surface/50 border border-white/5 rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-secondary uppercase tracking-widest">
          Your {langLabel}
        </p>
        {gap > 0 && (
          <p className="text-[11px] text-muted">
            Production is {gap} {gap === 1 ? 'level' : 'levels'} behind recognition — that's normal
          </p>
        )}
      </div>
      <div className="space-y-2">
        <ScoreBar
          label="Recognition"
          tooltip="From your flashcard mastery (passive)"
          cefrLabel={p.recognition_label}
          pct={recPct}
          color="from-sky-400 to-blue-500"
        />
        <ScoreBar
          label="Production"
          tooltip="From your chat performance (active)"
          cefrLabel={p.production_label}
          pct={prodPct}
          color="from-fuchsia-500 to-purple-600"
        />
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  tooltip,
  cefrLabel,
  pct,
  color,
}: {
  label: string;
  tooltip: string;
  cefrLabel: string | null;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-primary" title={tooltip}>
          {label}
        </p>
        <p className="text-sm font-bold text-primary">
          {cefrLabel || '—'}
        </p>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} transition-all`}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
    </div>
  );
}

function MicButton({
  recording,
  transcribing,
  onStart,
  onStop,
  disabled,
  large = false,
}: {
  recording: boolean;
  transcribing: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  large?: boolean;
}) {
  const size = large ? 'w-14 h-14' : 'w-12 h-12';
  const iconSize = large ? 'w-6 h-6' : 'w-5 h-5';
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={onStart}
      onMouseUp={onStop}
      onMouseLeave={() => recording && onStop()}
      onTouchStart={(e) => { e.preventDefault(); onStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); onStop(); }}
      className={`${size} rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-50 ${
        recording
          ? 'bg-red-500 shadow-red-500/50 scale-110 animate-pulse'
          : 'bg-accent text-app shadow-accent/40 hover:scale-105 hover:shadow-accent/60'
      }`}
      style={recording ? { color: 'white' } : undefined}
      title={recording ? 'Release to send' : 'Hold to speak in Spanish'}>
      {transcribing ? (
        <Loader2 className={`${iconSize} animate-spin`} />
      ) : (
        <Mic className={iconSize} />
      )}
    </button>
  );
}

function LevelDial({ value, onChange }: { value: Level; onChange: (v: Level) => void }) {
  return (
    <div className="flex items-center gap-1 bg-surface/50 border border-white/10 rounded-full p-0.5">
      {LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            value === l
              ? 'bg-accent text-app'
              : 'text-secondary hover:text-primary'
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({
  msg,
  onSaveWord,
  savedLemmas,
  savingLemmas,
  onToggleTranslation,
  onPlayAudio,
}: {
  msg: Msg;
  onSaveWord: (chip: OffListLemma, turnId?: number) => void;
  savedLemmas: Set<string>;
  savingLemmas: Set<string>;
  onToggleTranslation: () => void;
  onPlayAudio: () => void;
}) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%]">
        <div
          className={`rounded-2xl px-5 py-3 shadow-sm ${
            isUser
              ? 'bg-accent text-app rounded-tr-sm'
              : 'bg-white/10 text-primary rounded-tl-sm'
          }`}>
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {msg.text}
            {msg.isStreaming && (
              <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
            )}
          </p>
          {!isUser && !msg.isStreaming && msg.text && (
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={onPlayAudio}
                className="text-[11px] text-secondary hover:text-primary inline-flex items-center gap-1">
                {msg.audioLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
                {msg.audioUrl ? 'Replay' : 'Play'}
              </button>
              <button
                onClick={onToggleTranslation}
                className="text-[11px] text-secondary hover:text-primary inline-flex items-center gap-1">
                <Languages className="w-3 h-3" />
                {msg.showTranslation ? 'Hide' : 'Translate'}
              </button>
            </div>
          )}
        </div>

        {/* Off-list lemma chips */}
        {!isUser && !msg.isStreaming && msg.offList && msg.offList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.offList.map((chip) => {
              const saved = savedLemmas.has(chip.lemma);
              const saving = savingLemmas.has(chip.lemma);
              return (
                <button
                  key={chip.lemma}
                  onClick={() => onSaveWord(chip, msg.turnId)}
                  disabled={saved || saving}
                  className={`text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                    saved
                      ? 'bg-accent/10 border-accent/30 text-accent cursor-default'
                      : saving
                      ? 'bg-white/5 border-white/10 text-muted'
                      : 'bg-white/5 border-white/10 text-secondary hover:text-primary hover:border-accent/30'
                  }`}>
                  {saved ? '✓' : saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  <span>{chip.surface}</span>
                </button>
              );
            })}
          </div>
        )}

        {!isUser && msg.showTranslation && (
          <div className="mt-2 text-xs text-secondary italic px-1">
            {msg.translationLoading
              ? 'Translating…'
              : msg.translation || '(no translation yet)'}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionSummaryModal({
  summary,
  savedLemmas,
  onSaveAll,
  onTalkAgain,
  onClose,
}: {
  summary: SessionSummary;
  token: string | null;
  sessionId?: number;
  savedLemmas: Set<string>;
  onSaveAll: (lemmas: OffListLemma[]) => Promise<void>;
  onTalkAgain?: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [savingAll, setSavingAll] = useState(false);
  const remaining = summary.encountered_new_words.filter((w) => !savedLemmas.has(w.lemma));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-heading font-bold text-primary">Nice work</h2>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-app/50 rounded-2xl p-3">
              <p className="text-xs text-muted">Turns</p>
              <p className="text-lg font-bold text-primary">{summary.turn_count}</p>
            </div>
            <div className="bg-app/50 rounded-2xl p-3">
              <p className="text-xs text-muted">Level</p>
              <p className="text-lg font-bold text-primary">
                {summary.rubric.production_level || '—'}
              </p>
            </div>
          </div>

          {summary.rubric.feedback_note && (
            <p className="text-sm text-secondary leading-relaxed">
              {summary.rubric.feedback_note}
            </p>
          )}

          {summary.proficiency && (
            <ProficiencyStrip p={summary.proficiency} />
          )}

          {summary.rubric.strengths && summary.rubric.strengths.length > 0 && (
            <div>
              <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                What you did well
              </p>
              <ul className="text-sm text-secondary space-y-1">
                {summary.rubric.strengths.map((s, i) => <li key={i}>• {s}</li>)}
              </ul>
            </div>
          )}

          {summary.encountered_new_words.length > 0 && (
            <div>
              <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                {summary.encountered_new_words.length} new words encountered
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {summary.encountered_new_words.slice(0, 12).map((w) => (
                  <span
                    key={w.lemma}
                    className={`text-xs px-2 py-1 rounded-full ${
                      savedLemmas.has(w.lemma)
                        ? 'bg-accent/10 text-accent border border-accent/30'
                        : 'bg-white/5 text-secondary border border-white/10'
                    }`}>
                    {savedLemmas.has(w.lemma) && '✓ '}{w.lemma}
                  </span>
                ))}
              </div>
              {remaining.length > 0 && (
                <button
                  onClick={async () => {
                    setSavingAll(true);
                    await onSaveAll(remaining);
                    setSavingAll(false);
                  }}
                  disabled={savingAll}
                  className="w-full bg-accent text-app font-bold py-3 rounded-full hover:bg-accent-hover transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                  {savingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save {remaining.length} to deck
                </button>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {onTalkAgain && (
              <button
                onClick={onTalkAgain}
                className="flex-1 bg-accent text-app font-bold py-3 rounded-full hover:bg-accent-hover transition-colors">
                Talk again about this
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 bg-white/5 text-primary font-medium py-3 rounded-full hover:bg-white/10 transition-colors">
              New chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
