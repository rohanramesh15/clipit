import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Keyboard, Send, X, ArrowLeft, Lightbulb, HelpCircle,
  Loader2, ChevronRight, Film, Check, MessageCircle,
} from 'lucide-react';
import {
  getProfile, createSession, sendTurn, getHint, howDoISay, translate,
  correctionFeedback, voiceWsUrl,
  type Profile, type DueWord, type Correction, type SuggestedReply,
} from '../services/converseV2';
import {
  fetchTrackedVideos, fetchVideoCards,
  type TrackedVideo, type FlashCard,
} from '../services/madlibs';
import { VoiceSession, VoiceEvent } from '../lib/voiceSession';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PracticeEmptyState, type NavPage } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';
import { Persona, type PersonaState } from '../components/ai-elements/persona';

// App accent (matches --accent in index.css).
const ACCENT = '#C4625A';
// Voice Chat card color — used for non-button accents so the page echoes its card.
const PAGE = '#D98A6E';
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

type Phase = 'deck' | 'loading' | 'chat' | 'empty';
type VoiceStatus = 'off' | 'connecting' | 'listening' | 'speaking';

interface TargetWord {
  lemma: string;    // dictionary form (sent to the backend, shown on the pill)
  gloss: string;    // English meaning
  surface: string;  // the form as it appeared in the video (helps detect usage)
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  translation?: string;
  correction?: Correction | null;
  turnId?: number;
  suggestedReplies?: SuggestedReply[];
  targets?: string[];
}

// Target-language display names (used in UI copy + matching tweaks).
const LANG_NAMES: Record<string, string> = { es: 'Spanish', uk: 'Ukrainian', ko: 'Korean', en: 'English' };

// ── word-usage matching ───────────────────────────────────────────────────────
// Strip combining marks + punctuation, lowercase. Keeps ALL letters (Latin,
// Cyrillic, Hangul) so Korean/Ukrainian words match, not just Spanish.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

// Does a single user token count as a use of this target word?
function tokenMatches(token: string, t: TargetWord): boolean {
  const tok = norm(token);
  if (!tok) return false;
  for (const form of [t.lemma, t.surface]) {
    const f = norm(form);
    if (!f) continue;
    if (tok === f) return true;
    // Share a long common prefix → likely the same word, different inflection.
    const min = Math.min(tok.length, f.length);
    if (min >= 4) {
      let i = 0;
      while (i < min && tok[i] === f[i]) i++;
      if (i >= Math.max(4, f.length - 2)) return true;
    }
  }
  return false;
}

function lemmasUsedIn(text: string, targets: TargetWord[]): string[] {
  const tokens = text.split(/\s+/);
  const hit: string[] = [];
  for (const t of targets) {
    if (tokens.some((tk) => tokenMatches(tk, t))) hit.push(t.lemma);
  }
  return hit;
}

// ── Tappable Spanish text — tap any word for its meaning ──────────────────────
function stripPunct(word: string): string {
  return word.replace(/^[¿?¡!.,;:"'()«»…]+|[¿?¡!.,;:"'()«»…]+$/gu, '');
}

function TappableText({
  text, targets = [], onWordTap,
}: {
  text: string;
  targets?: string[];
  onWordTap: (word: string, e: React.MouseEvent) => void;
}) {
  const targetSet = new Set(targets.map((t) => t.toLowerCase()));
  const tokens = text.split(/(\s+)/);
  return (
    <span>
      {tokens.map((tk, i) => {
        if (/^\s+$/.test(tk) || tk === '') return <span key={i}>{tk}</span>;
        const clean = stripPunct(tk).toLowerCase();
        if (!clean) return <span key={i}>{tk}</span>;
        const isTarget = targetSet.has(clean);
        return (
          <span
            key={i}
            onClick={(e) => onWordTap(clean, e)}
            className={
              'cursor-pointer rounded-md px-1 py-0.5 transition-colors hover:bg-black/5 ' +
              (isTarget ? 'font-semibold' : '')
            }
            style={isTarget ? { color: PAGE } : undefined}
          >
            {tk}
          </span>
        );
      })}
    </span>
  );
}

// ── Voice persona — Vercel's official Rive Persona (ai-elements), driven by the
// live voice state, with an audio-reactive halo behind it that scales with the
// REAL audio level (mic while you speak, speaker while the tutor speaks).
const STATUS_TO_PERSONA: Record<VoiceStatus, PersonaState> = {
  off: 'idle',
  connecting: 'thinking',
  listening: 'listening',
  speaking: 'speaking',
};

function VoicePersona({ status, level, onToggle }: { status: VoiceStatus; level: number; onToggle: () => void }) {
  const active = status !== 'off';
  const lvl = Math.max(0, Math.min(1, level));
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={status === 'connecting'}
      title={active ? 'End call' : 'Start voice'}
      aria-label={active ? 'End call' : 'Start voice'}
      className="relative inline-flex items-center justify-center w-[96px] h-[96px] shrink-0 transition-transform active:scale-95 disabled:opacity-70"
    >
      {/* audio-reactive halo behind the Rive orb */}
      {active && (
        <span
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: hexA(PAGE, status === 'speaking' ? 0.22 : 0.16),
            transform: `scale(${0.62 + lvl * 0.55})`,
            opacity: 0.7,
            transition: 'transform 90ms ease-out, opacity 120ms linear',
          }}
        />
      )}
      <Persona
        state={STATUS_TO_PERSONA[status]}
        variant="obsidian"
        className="size-20 relative pointer-events-none"
      />
    </button>
  );
}

// ==============================================================================
// Main page
// ==============================================================================

export function ConverseV2Page(
  { onBack, onNavigate }: { onBack?: () => void; onNavigate?: (page: NavPage) => void } = {},
) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { token } = useAuth();
  const langName = LANG_NAMES[language] || 'Spanish';

  const [phase, setPhase] = useState<Phase>('deck');
  const [profile, setProfile] = useState<Profile | null>(null);

  // deck picker
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null);

  // active session
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);
  const [targetWords, setTargetWords] = useState<TargetWord[]>([]);
  const [usedLemmas, setUsedLemmas] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // text composer / scaffolding
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [shownTranslations, setShownTranslations] = useState<Set<string>>(new Set());
  const [revealedCorrections, setRevealedCorrections] = useState<Set<string>>(new Set());
  const [correctionVerdicts, setCorrectionVerdicts] = useState<Record<string, 'fine' | 'wrong'>>({});

  // ladder
  const [nudge, setNudge] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);
  const [howtoInput, setHowtoInput] = useState('');
  const [howtoLoading, setHowtoLoading] = useState(false);
  const [howtoResult, setHowtoResult] = useState<{ spanish: string; note_en: string } | null>(null);
  const [status, setStatus] = useState('');

  // word popover
  const [pop, setPop] = useState<{ word: string; text: string; loading: boolean; x: number; y: number } | null>(null);

  // voice
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('off');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0); // 0..1 live audio level for the persona
  const speakingRef = useRef(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  const vUserId = useRef<string | null>(null);
  const vAsstId = useRef<string | null>(null);
  const voiceAutoStarted = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ── load profile (display only) + tracked videos for the deck ───────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { profile: p } = await getProfile();
        if (alive) setProfile(p);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setVideos(null);
    fetchTrackedVideos(language, token).then((v) => { if (alive) setVideos(v); });
    return () => { alive = false; };
  }, [language, token]);

  // ── auto-scroll transcript ──────────────────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, composerOpen, nudge, howtoOpen, sending]);

  // ── mark target words as used whenever the learner uses them ────────────────
  // Covers both typed turns and live voice transcripts.
  useEffect(() => {
    if (!targetWords.length) return;
    setUsedLemmas((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const m of messages) {
        if (m.role !== 'user') continue;
        for (const lemma of lemmasUsedIn(m.text, targetWords)) {
          if (!next.has(lemma)) { next.add(lemma); changed = true; }
        }
      }
      return changed ? next : prev;
    });
  }, [messages, targetWords]);

  // ── close popover on scroll / outside click / escape ────────────────────────
  useEffect(() => {
    if (!pop) return;
    const close = () => setPop(null);
    window.addEventListener('scroll', close, true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null);
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => window.addEventListener('click', close), 0);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', close);
      clearTimeout(t);
    };
  }, [pop]);

  // ── voice wiring ────────────────────────────────────────────────────────────
  const appendVoiceChunk = useCallback((role: 'user' | 'assistant', chunk: string) => {
    const ref = role === 'user' ? vUserId : vAsstId;
    setMessages((prev) => {
      if (ref.current) {
        return prev.map((m) => (m.id === ref.current ? { ...m, text: m.text + chunk } : m));
      }
      const id = `v-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      ref.current = id;
      return [...prev, { id, role, text: chunk }];
    });
  }, []);

  const handleVoiceEvent = useCallback((e: VoiceEvent) => {
    switch (e.type) {
      case 'connecting': setVoiceStatus('connecting'); setStatus('Connecting your mic…'); return;
      case 'ready': speakingRef.current = false; setVoiceLevel(0); setVoiceStatus('listening'); setStatus('Listening… just talk'); return;
      case 'speaking_changed':
        speakingRef.current = e.speaking;
        setVoiceLevel(0);
        setVoiceStatus(e.speaking ? 'speaking' : 'listening');
        setStatus(e.speaking ? 'Tutor is speaking…' : 'Your turn — just talk');
        return;
      case 'mic_level': if (!speakingRef.current) setVoiceLevel(e.level); return;
      case 'speaker_level': if (speakingRef.current) setVoiceLevel(e.level); return;
      case 'user_transcript': return appendVoiceChunk('user', e.text);
      case 'assistant_transcript': return appendVoiceChunk('assistant', e.text);
      case 'interrupted':
        if (vAsstId.current) {
          const id = vAsstId.current;
          setMessages((prev) => prev.filter((m) => m.id !== id));
          vAsstId.current = null;
        }
        return;
      case 'turn_complete': vUserId.current = null; vAsstId.current = null; return;
      case 'error': speakingRef.current = false; setVoiceLevel(0); setVoiceError(e.message); setVoiceStatus('off'); setStatus(''); return;
      case 'closed': vUserId.current = null; vAsstId.current = null; speakingRef.current = false; setVoiceLevel(0); setVoiceStatus('off'); return;
    }
  }, [appendVoiceChunk]);

  const startVoice = useCallback(async () => {
    if (!sessionId || voiceStatus !== 'off') return;
    setVoiceError(null);
    const vs = new VoiceSession();
    vs.on(handleVoiceEvent);
    voiceRef.current = vs;
    try {
      await vs.start(voiceWsUrl(sessionId, language));
    } catch (e: any) {
      setVoiceError(e?.message || 'Could not start voice');
      setVoiceStatus('off');
    }
  }, [sessionId, voiceStatus, handleVoiceEvent, language]);

  const stopVoice = useCallback(() => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    vUserId.current = null;
    vAsstId.current = null;
    speakingRef.current = false;
    setVoiceLevel(0);
    setVoiceStatus('off');
    setStatus('Tap the mic to talk, or the keyboard to type');
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceStatus === 'off') startVoice(); else stopVoice();
  }, [voiceStatus, startVoice, stopVoice]);

  useEffect(() => () => { voiceRef.current?.stop(); voiceRef.current = null; }, []);

  // auto-start the call once we land in chat
  useEffect(() => {
    if (phase !== 'chat' || !sessionId || voiceAutoStarted.current) return;
    voiceAutoStarted.current = true;
    startVoice();
  }, [phase, sessionId, startVoice]);

  // ── start a session from a chosen video ─────────────────────────────────────
  const startFromVideo = useCallback(async (video: TrackedVideo) => {
    setDeck({ id: video.video_id, title: video.title });
    setPhase('loading');
    setChatError(null);
    try {
      const cards: FlashCard[] = await fetchVideoCards(video.video_id, language);
      // Build the target words (dictionary form + gloss + surface), dedup by lemma.
      const seen = new Set<string>();
      const words: TargetWord[] = [];
      for (const c of cards) {
        const lemma = (c.dictionary_form || c.target_word || '').trim();
        if (!lemma) continue;
        const key = lemma.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        words.push({ lemma, gloss: c.english || '', surface: (c.target_word || lemma).trim() });
        if (words.length >= 8) break;
      }

      const result = await createSession({
        seed_type: 'video',
        video_id: video.video_id,
        seed_label: video.title,
        language,
        seed_words: words.map((w) => ({ lemma: w.lemma, gloss: w.gloss })),
      });

      // Prefer the words we built (they carry surface forms for usage detection);
      // fall back to whatever the backend echoed.
      const finalWords: TargetWord[] = words.length
        ? words
        : (result.due_words || []).map((d: DueWord) => ({ lemma: d.lemma, gloss: d.gloss, surface: d.lemma }));

      setTargetWords(finalWords);
      setUsedLemmas(new Set());
      setShownTranslations(new Set());
      setRevealedCorrections(new Set());
      setCorrectionVerdicts({});
      setNudge(null);
      setHowtoOpen(false);
      setHowtoResult(null);
      setComposerOpen(false);
      setComposerText('');
      voiceAutoStarted.current = false;
      setVoiceStatus('off');
      setVoiceError(null);
      setSessionId(result.session_id);
      setStatus('Connecting your mic…');
      setMessages([{
        id: `a-${result.opening.turn_id}`,
        role: 'assistant',
        text: result.opening.reply,
        translation: result.opening.reply_translation,
        turnId: result.opening.turn_id,
      }]);
      setPhase('chat');
    } catch {
      setChatError('Could not start the conversation. Please try again.');
      setPhase('deck');
    }
  }, [language]);

  const leaveChat = useCallback(() => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    vUserId.current = null;
    vAsstId.current = null;
    voiceAutoStarted.current = false;
    setVoiceStatus('off');
    setVoiceError(null);
    setSessionId(null);
    setMessages([]);
    setTargetWords([]);
    setUsedLemmas(new Set());
    setComposerOpen(false);
    setComposerText('');
    setNudge(null);
    setHowtoOpen(false);
    setHowtoResult(null);
    setShowLeaveConfirm(false);
    setPhase('deck');
  }, []);

  // ── chat actions ────────────────────────────────────────────────────────────
  const sendTextTurn = useCallback(async (override?: string) => {
    const text = (override ?? composerText).trim();
    if (!text || sending || sessionId == null) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setComposerText('');
    setNudge(null);
    setSending(true);
    setStatus('Tutor is writing…');
    try {
      const result = await sendTurn(sessionId, text, language);
      setMessages((prev) => [...prev, {
        id: `a-${result.turn_id}`,
        role: 'assistant',
        text: result.reply,
        translation: result.reply_translation,
        correction: result.correction,
        turnId: result.turn_id,
        suggestedReplies: result.suggested_replies,
        targets: result.used_target_words || [],
      }]);
      setStatus('Tap a word for its meaning · pick a suggested reply below');
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setComposerText(text);
      setChatError('Message failed to send. Try again.');
    } finally {
      setSending(false);
    }
  }, [composerText, sending, sessionId, language]);

  const handleWordTap = useCallback(async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.target as HTMLElement).getBoundingClientRect();
    setPop({ word, text: '', loading: true, x: r.left + r.width / 2, y: r.top });
    try {
      const t = await translate(word, language);
      setPop((cur) => (cur && cur.word === word ? { ...cur, text: t, loading: false } : cur));
    } catch {
      setPop((cur) => (cur && cur.word === word ? { ...cur, text: '—', loading: false } : cur));
    }
  }, [language]);

  const handleHint = useCallback(async () => {
    if (sessionId == null) return;
    setHintLoading(true);
    try {
      const { hint_en } = await getHint(sessionId, language);
      setNudge(hint_en);
    } catch {
      setNudge('Try answering with one short sentence — even a few words helps.');
    } finally {
      setHintLoading(false);
    }
  }, [sessionId, language]);

  const runHowto = useCallback(async () => {
    if (sessionId == null) return;
    const english = howtoInput.trim();
    if (!english) return;
    setHowtoLoading(true);
    setHowtoResult(null);
    try {
      setHowtoResult(await howDoISay(sessionId, english, language));
    } catch {
      setHowtoResult({ spanish: '', note_en: "Couldn't fetch a phrasing." });
    } finally {
      setHowtoLoading(false);
    }
  }, [sessionId, howtoInput, language]);

  const handleCorrectionFb = useCallback(async (messageId: string, turnId: number | undefined, verdict: 'fine' | 'wrong') => {
    if (turnId == null || correctionVerdicts[messageId]) return;
    setCorrectionVerdicts((prev) => ({ ...prev, [messageId]: verdict }));
    try { await correctionFeedback(turnId, verdict); } catch { /* keep optimistic */ }
  }, [correctionVerdicts]);

  const openComposer = () => { setComposerOpen(true); setNudge(null); setTimeout(() => taRef.current?.focus(), 60); };
  const pickSuggestion = (es: string) => { setComposerOpen(true); setComposerText(es); setTimeout(() => taRef.current?.focus(), 60); };

  const translationShownByDefault = profile?.english_support === 'lots';
  const isTransVisible = (id: string) =>
    translationShownByDefault ? !shownTranslations.has(id) : shownTranslations.has(id);
  const toggleTrans = (id: string) =>
    setShownTranslations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'assistant') return messages[i].id;
    return null;
  }, [messages]);

  const usedCount = usedLemmas.size;

  // ============================================================================
  // Deck picker
  // ============================================================================
  const header = (back: () => void, label: string) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={back}
        aria-label={label}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-black/5 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="font-heading font-bold text-xl text-primary">Voice Chat</h1>
    </div>
  );

  if (phase === 'deck') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-3xl mx-auto">
        {header(() => onNavigate?.('practice'), 'Back to Practice')}
        <p className="text-secondary mb-8">
          Pick a video to talk about — we'll weave the words it taught you into the conversation.
        </p>

        {chatError && (
          <div className="mb-4 text-sm font-medium" style={{ color: ACCENT }}>{chatError}</div>
        )}

        {videos === null ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : videos.length === 0 ? (
          <PracticeEmptyState onNavigate={(p) => onNavigate?.(p)} />
        ) : (
          <div className="space-y-3">
            {videos.map((v, i) => {
              const isNetflix = v.video_id.startsWith('netflix_');
              return (
                <motion.button
                  key={v.video_id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => startFromVideo(v)}
                  className="group w-full flex items-center gap-5 bg-surface rounded-2xl p-5 text-left hover:bg-surface-hover transition-colors"
                >
                  <span className="relative w-32 aspect-video shrink-0 rounded-lg overflow-hidden bg-black/5 flex items-center justify-center">
                    {isNetflix ? (
                      <Film className="w-5 h-5" style={{ color: ACCENT }} />
                    ) : (
                      <img
                        src={`https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium text-primary truncate">{v.title}</span>
                    <span className="block text-xs text-muted">Talk through its words by voice</span>
                  </span>
                  <ChevronRight className="w-5 h-5 shrink-0 text-muted group-hover:text-accent transition-colors" />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // Loading a session
  // ============================================================================
  if (phase === 'loading') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-2xl mx-auto">
        {header(leaveChat, 'Back to videos')}
        <div className="flex flex-wrap gap-2 mb-8">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-16 w-3/4 rounded-2xl" />
          <Skeleton className="h-12 w-1/2 rounded-2xl ml-auto" />
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
        </div>
        <div className="mt-10 flex justify-center">
          <Skeleton className="h-[68px] w-[68px] rounded-full" />
        </div>
      </div>
    );
  }

  // ============================================================================
  // Chat
  // ============================================================================
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-2xl mx-auto">
      {/* header + word tracker */}
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setShowLeaveConfirm(true)}
              aria-label="Back to videos"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-secondary hover:text-primary hover:bg-black/5 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-heading font-bold text-base text-primary truncate">
                {deck?.title || 'Voice Chat'}
              </h1>
            </div>
          </div>
          {targetWords.length > 0 && (
            <span className="text-xs font-medium text-secondary tabular-nums shrink-0">
              {usedCount} / {targetWords.length} used
            </span>
          )}
        </div>

        {targetWords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {targetWords.map((w) => {
              const used = usedLemmas.has(w.lemma);
              return (
                <span
                  key={w.lemma}
                  title={w.gloss}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-all ' +
                    (used ? 'text-white' : 'bg-surface text-secondary')
                  }
                  style={used ? { background: PAGE } : undefined}
                >
                  {used && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  {w.lemma}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-1 px-1 py-2 space-y-4">
        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] text-xl leading-relaxed text-secondary text-right">
                  {m.text}
                </div>
              </div>
            );
          }
          const transVisible = isTransVisible(m.id);
          const revealed = revealedCorrections.has(m.id);
          const verdict = correctionVerdicts[m.id];
          const isLast = m.id === lastAssistantId;
          return (
            <div key={m.id} className="flex flex-col items-start gap-2">
              <div className="max-w-[90%] text-xl leading-relaxed text-primary font-medium">
                <TappableText text={m.text} targets={m.targets} onWordTap={handleWordTap} />
              </div>

              <div className="flex flex-col gap-2 w-full">
                {m.translation && (
                  <button
                    onClick={() => toggleTrans(m.id)}
                    className="self-start text-xs font-medium text-muted hover:text-secondary transition-colors"
                  >
                    {transVisible ? 'Hide English' : 'Show in English'}
                  </button>
                )}
                {m.translation && transVisible && (
                  <div className="text-sm text-secondary italic -mt-1">{m.translation}</div>
                )}

                {m.correction && (!revealed ? (
                  <button
                    onClick={() => setRevealedCorrections((prev) => new Set(prev).add(m.id))}
                    className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-secondary transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" /> A better way to say that
                  </button>
                ) : (
                  <div className="rounded-xl bg-black/5 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">A better way to say that</div>
                    <div className="text-[15px] font-medium text-primary" style={{ color: PAGE }}>{m.correction.correct}</div>
                    <div className="text-sm text-secondary mt-1">{m.correction.why_en}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className={'text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ' + (verdict === 'fine' ? 'text-white' : 'bg-surface text-secondary hover:text-primary')}
                        style={verdict === 'fine' ? { background: ACCENT } : undefined}
                        disabled={!!verdict}
                        onClick={() => handleCorrectionFb(m.id, m.turnId, 'fine')}
                      >
                        Mine was fine
                      </button>
                      <button
                        className={'text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ' + (verdict === 'wrong' ? 'text-white' : 'bg-surface text-secondary hover:text-primary')}
                        style={verdict === 'wrong' ? { background: ACCENT } : undefined}
                        disabled={!!verdict}
                        onClick={() => handleCorrectionFb(m.id, m.turnId, 'wrong')}
                      >
                        Not right
                      </button>
                      {verdict && <span className="text-xs text-muted">thanks</span>}
                    </div>
                  </div>
                ))}

                {isLast && m.suggestedReplies && m.suggestedReplies.length > 0 && (
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Suggested replies</div>
                    {m.suggestedReplies.slice(0, 3).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => pickSuggestion(s.es)}
                        className="text-left rounded-xl bg-surface hover:bg-surface-hover transition-colors px-3 py-2"
                      >
                        <div className="text-sm text-primary">{s.es}</div>
                        {s.en && <div className="text-xs text-muted mt-0.5">{s.en}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {sending && <div className="text-sm text-muted">Tutor is writing…</div>}
      </div>

      {/* dock */}
      <div className="shrink-0 pt-3">
        <AnimatePresence>
          {nudge && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="flex items-start gap-2 rounded-xl bg-surface p-3 mb-3"
            >
              <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: PAGE }} />
              <span className="flex-1 text-sm text-secondary">{nudge}</span>
              <button onClick={() => setNudge(null)} className="text-muted hover:text-primary"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {howtoOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="rounded-xl bg-surface p-3 mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-primary">How do I say…?</h4>
                <button onClick={() => { setHowtoOpen(false); setHowtoInput(''); setHowtoResult(null); }} className="text-muted hover:text-primary"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={howtoInput}
                  placeholder="Say it in English…"
                  onChange={(e) => setHowtoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runHowto(); } }}
                  className="flex-1 rounded-lg bg-app px-3 py-2 text-sm text-primary placeholder:text-muted outline-none"
                />
                <button
                  onClick={runHowto}
                  disabled={howtoLoading || !howtoInput.trim()}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: ACCENT }}
                >
                  {howtoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Translate'}
                </button>
              </div>
              {howtoResult && howtoResult.spanish && (
                <div className="mt-3 rounded-lg bg-app p-3">
                  <div className="text-sm font-medium text-primary">{howtoResult.spanish}</div>
                  {howtoResult.note_en && <div className="text-xs text-muted mt-1">{howtoResult.note_en}</div>}
                  <button
                    onClick={() => pickSuggestion(howtoResult!.spanish)}
                    className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg text-white"
                    style={{ background: ACCENT }}
                  >
                    Use this
                  </button>
                </div>
              )}
              {howtoResult && !howtoResult.spanish && howtoResult.note_en && (
                <div className="mt-2 text-xs text-muted">{howtoResult.note_en}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {composerOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="flex items-end gap-2 rounded-2xl bg-surface p-2 mb-3"
            >
              <button
                onClick={() => { setComposerOpen(false); setComposerText(''); }}
                title="Close"
                aria-label="Close typing"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-primary hover:bg-black/5 shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <textarea
                ref={taRef}
                rows={1}
                value={composerText}
                placeholder={`Type in ${langName}…`}
                onChange={(e) => {
                  setComposerText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextTurn(); } }}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-primary placeholder:text-muted outline-none max-h-32"
              />
              <button
                onClick={() => sendTextTurn()}
                disabled={!composerText.trim() || sending}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-white disabled:opacity-40 shrink-0"
                style={{ background: ACCENT }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-center gap-3 mt-10">
          <button
            onClick={handleHint}
            disabled={hintLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface text-sm font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
          >
            {hintLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
            <span className="hidden sm:inline">Stuck?</span>
          </button>

          <VoicePersona status={voiceStatus} level={voiceLevel} onToggle={toggleVoice} />

          <button
            onClick={() => (composerOpen ? (setComposerOpen(false), setComposerText('')) : openComposer())}
            title="Type instead"
            className={
              'w-11 h-11 flex items-center justify-center rounded-full transition-colors ' +
              (composerOpen ? 'text-white' : 'bg-surface text-secondary hover:text-primary hover:bg-surface-hover')
            }
            style={composerOpen ? { background: ACCENT } : undefined}
          >
            <Keyboard className="w-5 h-5" />
          </button>

          <button
            onClick={() => setHowtoOpen((v) => !v)}
            className={
              'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ' +
              (howtoOpen ? 'text-white' : 'bg-surface text-secondary hover:text-primary hover:bg-surface-hover')
            }
            style={howtoOpen ? { background: ACCENT } : undefined}
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">How do I say…?</span>
          </button>
        </div>

        <div className="text-center text-xs text-muted mt-2 h-4">
          {voiceError ? <span style={{ color: ACCENT }}>{voiceError}</span>
            : chatError ? <span style={{ color: ACCENT }}>{chatError}</span>
            : status}
        </div>
      </div>

      {/* leave-chat confirmation */}
      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLeaveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-primary mb-2">Leave this conversation?</h3>
              <p className="text-sm text-secondary mb-6">
                Going back will end and delete this conversation. This can't be undone.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={leaveChat}
                  className="w-full px-4 py-2.5 rounded-xl text-white font-semibold text-sm"
                  style={{ background: ACCENT }}
                >
                  Leave & delete
                </button>
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="w-full px-4 py-2.5 rounded-xl bg-app text-secondary hover:text-primary font-semibold text-sm transition-colors"
                >
                  Keep talking
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* word popover — tapped word + its English meaning */}
      {pop && (
        <span
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl bg-primary text-app shadow-xl pointer-events-none"
          style={{ left: pop.x, top: pop.y - 10, maxWidth: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block px-3 py-2">
            <span className="block text-sm font-bold">{pop.word}</span>
            <span className="block text-[11px] uppercase tracking-wide opacity-60 mt-1">English meaning</span>
            <span className="block text-sm opacity-90">
              {pop.loading ? 'Translating…' : (pop.text || '—')}
            </span>
          </span>
        </span>
      )}
    </div>
  );
}
