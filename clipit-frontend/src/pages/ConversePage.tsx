import { useCallback, useEffect, useRef, useState } from 'react';
import { Construction, Mic, Phone, PhoneOff, FileText, X, Sparkles } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  ChatSessionInfo,
  SessionSummary,
  createSession,
  endSession,
} from '../services/chat';
import { VoiceSession, VoiceEvent, buildWsUrl } from '../lib/voiceSession';
import { LoadingAnimation } from '../components/LoadingAnimation';

const SUPPORTED_CHAT_LANGUAGES = new Set(['es', 'en']);
const LEVELS = ['A1', 'A2', 'B1'] as const;
type Level = (typeof LEVELS)[number];

type Status = 'idle' | 'connecting' | 'listening' | 'speaking' | 'ended';

const LANG_COPY: Record<string, { hi: string; tagline: string; tapToStart: string; listening: string; speaking: string }> = {
  es: {
    hi: '¿Listo para hablar?',
    tagline: 'Just talk. I\'ll reply out loud in Spanish.',
    tapToStart: 'Tap to start the call',
    listening: 'Listening…',
    speaking: 'Speaking…',
  },
  en: {
    hi: 'Ready to talk?',
    tagline: 'Just talk. I\'ll reply out loud.',
    tapToStart: 'Tap to start the call',
    listening: 'Listening…',
    speaking: 'Speaking…',
  },
};

export function ConversePage() {
  const { language, languageName } = useLanguage();
  const { token } = useAuth();

  if (!SUPPORTED_CHAT_LANGUAGES.has(language)) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mb-6">
          <Construction className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-primary mb-3">
          Voice chat isn't available for {languageName} yet
        </h1>
        <p className="text-secondary max-w-md leading-relaxed">
          We're working to add it soon. Switch your learning language to Spanish or
          English from the sidebar to try the voice call.
        </p>
      </div>
    );
  }

  return <VoiceConverse token={token} language={language} />;
}

function VoiceConverse({ token, language }: { token: string | null; language: string }) {
  const copy = LANG_COPY[language] || LANG_COPY.es;

  const [status, setStatus] = useState<Status>('idle');
  const [level, setLevel] = useState<Level>('A2');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ChatSessionInfo | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [aiLevel, setAiLevel] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [ending, setEnding] = useState(false);

  const sessionRef = useRef<VoiceSession | null>(null);

  // Coalesce partial transcripts into single growing bubbles per role.
  const appendTranscript = useCallback(
    (role: 'user' | 'assistant', text: string) => {
      setTranscript((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === role) {
          return [...prev.slice(0, -1), { role, text: last.text + text }];
        }
        return [...prev, { role, text }];
      });
    },
    [],
  );

  const handleEvent = useCallback(
    (e: VoiceEvent) => {
      switch (e.type) {
        case 'connecting': return setStatus('connecting');
        case 'ready': return setStatus('listening');
        case 'mic_level': return setMicLevel(e.level);
        case 'speaker_level': return setAiLevel(e.level);
        case 'speaking_changed':
          return setStatus(e.speaking ? 'speaking' : 'listening');
        case 'user_transcript':
          return appendTranscript('user', e.text);
        case 'assistant_transcript':
          return appendTranscript('assistant', e.text);
        case 'interrupted':
          setAiLevel(0);
          return setStatus('listening');
        case 'error':
          setError(e.message);
          return setStatus('idle');
        case 'closed':
          return setStatus((s) => (s === 'ended' ? 'ended' : 'idle'));
      }
    },
    [appendTranscript],
  );

  const handleStart = useCallback(async () => {
    if (!token) {
      setError('Not signed in');
      return;
    }
    setError(null);
    setTranscript([]);
    setSummary(null);
    try {
      const s = await createSession(token, { seed_type: 'free', level, language });
      setSession(s);
      const vs = new VoiceSession();
      vs.on(handleEvent);
      sessionRef.current = vs;
      const url = buildWsUrl('/chat/voice/ws', { session_id: s.session_id, token });
      await vs.start(url);
    } catch (e: any) {
      setError(e?.message || 'Failed to start');
      setStatus('idle');
    }
  }, [token, level, language, handleEvent]);

  const handleEnd = useCallback(async () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus('ended');
    setMicLevel(0);
    setAiLevel(0);
    if (token && session && !ending) {
      setEnding(true);
      try {
        const r = await endSession(token, session.session_id);
        setSummary(r.summary);
      } catch {
        // session summary is non-critical
      } finally {
        setEnding(false);
      }
    }
  }, [token, session, ending]);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      sessionRef.current?.stop();
      sessionRef.current = null;
    };
  }, []);

  const orbLevel = Math.max(micLevel, aiLevel);
  const callActive = status === 'listening' || status === 'speaking' || status === 'connecting';

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Top: level dial only when idle; status hint when live */}
      <div className="px-2 pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">{copy.hi}</h1>
          <p className="text-secondary text-sm mt-0.5">{copy.tagline}</p>
        </div>
        {!callActive && status !== 'ended' && <LevelDial value={level} onChange={setLevel} />}
      </div>

      {/* Center: the orb */}
      <div className="flex-1 flex items-center justify-center">
        <Orb status={status} level={orbLevel} />
      </div>

      {/* Bottom: primary action + transcript toggle */}
      <div className="px-2 pb-8 flex flex-col items-center gap-4">
        <StatusLabel status={status} copy={copy} />
        {status === 'idle' && (
          <button
            onClick={handleStart}
            className="bg-accent text-app font-bold rounded-full px-8 py-4 inline-flex items-center gap-3 shadow-lg shadow-accent/40 hover:scale-[1.03] transition-transform">
            <Phone className="w-5 h-5" /> {copy.tapToStart}
          </button>
        )}
        {(status === 'connecting' || callActive) && (
          <button
            onClick={handleEnd}
            className="bg-red-500 text-white font-bold rounded-full px-8 py-4 inline-flex items-center gap-3 shadow-lg shadow-red-500/40 hover:scale-[1.03] transition-transform">
            <PhoneOff className="w-5 h-5" /> End call
          </button>
        )}
        {callActive && (
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="text-xs text-secondary hover:text-primary inline-flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {showTranscript ? 'Hide transcript' : 'Show transcript'}
          </button>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {/* Optional transcript drawer */}
      {showTranscript && callActive && (
        <div className="fixed right-4 bottom-32 top-24 w-80 bg-surface/95 backdrop-blur border border-white/10 rounded-2xl p-4 overflow-y-auto z-40 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary">Transcript</p>
            <button onClick={() => setShowTranscript(false)} className="text-secondary hover:text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          {transcript.length === 0 ? (
            <p className="text-xs text-muted">Nothing yet — start talking.</p>
          ) : (
            <div className="space-y-3">
              {transcript.map((t, i) => (
                <div key={i} className={`text-sm ${t.role === 'user' ? 'text-primary' : 'text-accent'}`}>
                  <span className="text-[10px] uppercase tracking-wider opacity-60 mr-1">{t.role === 'user' ? 'You' : 'AI'}</span>
                  {t.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* End-of-call summary */}
      {summary && (
        <SummaryModal
          summary={summary}
          ending={ending}
          onClose={() => {
            setSummary(null);
            setSession(null);
            setStatus('idle');
            setTranscript([]);
          }}
        />
      )}
    </div>
  );
}

function Orb({ status, level }: { status: Status; level: number }) {
  // Scale 1.0 → 1.35 with the audio level; ease the change to feel breathing.
  const scale = 1 + level * 0.35;
  const ring = status === 'speaking' ? 'from-fuchsia-500 via-purple-500 to-indigo-600'
    : status === 'listening' ? 'from-emerald-400 via-teal-500 to-cyan-600'
    : status === 'connecting' ? 'from-amber-400 via-orange-500 to-red-500'
    : 'from-slate-500 via-slate-600 to-slate-700';
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer breathing halo */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${ring} opacity-30 blur-2xl transition-transform duration-150 ease-out`}
        style={{ transform: `scale(${scale + 0.15})` }}
      />
      {/* Main orb */}
      <div
        className={`relative w-48 h-48 rounded-full bg-gradient-to-br ${ring} shadow-2xl transition-transform duration-150 ease-out`}
        style={{ transform: `scale(${scale})` }}>
        <div className="absolute inset-3 rounded-full bg-app/40 backdrop-blur flex items-center justify-center">
          {status === 'connecting' ? (
            <LoadingAnimation className="h-10 w-10" />
          ) : (
            <Mic className="w-10 h-10 text-white" style={{ opacity: 0.6 + level * 0.4 }} />
          )}
        </div>
      </div>
    </div>
  );
}

function StatusLabel({ status, copy }: { status: Status; copy: { listening: string; speaking: string } }) {
  if (status === 'connecting') return <p className="text-sm text-muted">Connecting…</p>;
  if (status === 'listening') return <p className="text-sm text-emerald-400">{copy.listening}</p>;
  if (status === 'speaking') return <p className="text-sm text-fuchsia-400">{copy.speaking}</p>;
  if (status === 'ended') return <p className="text-sm text-muted">Call ended</p>;
  return <p className="text-sm text-muted">&nbsp;</p>;
}

function LevelDial({ value, onChange }: { value: Level; onChange: (v: Level) => void }) {
  return (
    <div className="flex items-center gap-1 bg-surface/50 border border-white/10 rounded-full p-0.5">
      {LEVELS.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            value === l ? 'bg-accent text-app' : 'text-secondary hover:text-primary'
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function SummaryModal({
  summary,
  ending,
  onClose,
}: {
  summary: SessionSummary;
  ending: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-heading font-bold text-primary">Nice talk</h2>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {ending ? (
          <div className="flex items-center gap-2 text-secondary text-sm">
            <LoadingAnimation className="h-4 w-4" /> Scoring your call…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-app/50 rounded-2xl p-3">
                <p className="text-xs text-muted">Turns</p>
                <p className="text-lg font-bold text-primary">{summary.turn_count}</p>
              </div>
              <div className="bg-app/50 rounded-2xl p-3">
                <p className="text-xs text-muted">Level</p>
                <p className="text-lg font-bold text-primary">{summary.rubric.production_level || '—'}</p>
              </div>
            </div>
            {summary.rubric.feedback_note && (
              <p className="text-sm text-secondary leading-relaxed">{summary.rubric.feedback_note}</p>
            )}
            {summary.rubric.strengths && summary.rubric.strengths.length > 0 && (
              <div>
                <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">What you did well</p>
                <ul className="text-sm text-secondary space-y-1">
                  {summary.rubric.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full bg-accent text-app font-bold py-3 rounded-full hover:bg-accent-hover transition-colors">
              New call
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
