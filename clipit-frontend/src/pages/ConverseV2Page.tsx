import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Keyboard, Send, X, Lightbulb, HelpCircle, Check,
  Film, MessageCircle, Languages, Volume2, Copy, Search, Shuffle, BookmarkPlus, Play,
} from 'lucide-react';
import {
  getProfile, createSession, sendTurn, getHint, howDoISay, translate, romanize,
  correctionFeedback, voiceWsUrl, coachEnglish, regenerateTurn, suggestReplies,
  getRecentSession, resumeSession,
  type Profile, type DueWord, type Correction, type SuggestedReply,
  type RecentSession,
} from '../services/converseV2';
import { Sparkles, RotateCcw, MessageSquarePlus } from 'lucide-react';
import {
  fetchTrackedVideos, fetchVideoCards,
  type TrackedVideo, type FlashCard,
} from '../services/madlibs';
import { VoiceSession, VoiceEvent } from '../lib/voiceSession';
import { getDueCards } from '../services/fsrs';
import { getDeletedCards } from '../utils/flashcardStorage';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';
import { Persona, type PersonaState } from '../components/ai-elements/persona';
import { SpeechInput } from '../components/ai-elements/speech-input';
import { LoadingAnimation } from '../components/LoadingAnimation';
import { NavigationIconButton } from '../components/NavigationIconButton';

// AI chat's brand accent — matches the sage tokens the "AI chat" tile uses on
// the home screen (see tailwind.config.js `sage`), not the app's generic coral.
const ACCENT = '#4a7043'; // sage-ink
const PAGE = '#2e4a2a'; // sage-deep — used for non-button accents so the page echoes its card.
const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

type Phase = 'deck' | 'loading' | 'chat' | 'empty';
type VoiceStatus = 'off' | 'connecting' | 'listening' | 'speaking';
type NavPage = 'video' | 'practice' | 'flashcards' | 'analytics' | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

interface TargetWord {
  lemma: string;    // dictionary form (sent to the backend, shown on the pill)
  gloss: string;    // English meaning
  surface: string;  // the form as it appeared in the video (helps detect usage)
  clipLine?: string; // the sentence this word came from, if the source card had one
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
const LANG_NAMES: Record<string, string> = { uk: 'Ukrainian', ko: 'Korean', en: 'English' };

// Treat a learner utterance as English vs the target language (whichever is
// closest): if it contains no target-script characters but has Latin letters,
// it's English.
function isLikelyEnglish(text: string, language: string): boolean {
  const hasTarget =
    language === 'ko' ? /[가-힯]/.test(text)
    : language === 'uk' ? /[Ѐ-ӿ]/.test(text)
    : false;
  const hasLatin = /[a-z]/i.test(text);
  return !hasTarget && hasLatin;
}

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
              'cursor-pointer rounded-md px-1 py-0.5 transition-colors hover:bg-surface-hover ' +
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
  const langName = LANG_NAMES[language] || 'Korean';

  const [phase, setPhase] = useState<Phase>('deck');
  const [profile, setProfile] = useState<Profile | null>(null);

  // deck picker
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null);
  const [recentSession, setRecentSession] = useState<RecentSession | null>(null);
  const [resuming, setResuming] = useState(false);
  const [deckQuery, setDeckQuery] = useState('');

  // active session
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);
  const [targetWords, setTargetWords] = useState<TargetWord[]>([]);
  const [usedLemmas, setUsedLemmas] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  // Closed by default: the drawer overlays the chat at every width here (there's
  // no MP-style xl-and-up sidebar variant), so auto-opening it would cover the
  // conversation immediately on a narrower screen.
  const [coachOpen, setCoachOpen] = useState(false);
  const [openTargetWord, setOpenTargetWord] = useState<string | null>(null);

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
  // Words saved from the tap-word popover — session-scoped, matching MP's own
  // (also purely in-memory, never persisted) saved-words feature.
  const [savedWords, setSavedWords] = useState<{ lemma: string; gloss: string }[]>([]);
  const saveWord = useCallback((lemma: string, gloss: string) => {
    setSavedWords((prev) => (prev.some((w) => w.lemma.toLowerCase() === lemma.toLowerCase()) ? prev : [...prev, { lemma, gloss }]));
  }, []);

  // per-AI-message actions: on-demand translation + copy feedback + romanization
  const [msgTrans, setMsgTrans] = useState<Record<string, { text?: string; loading: boolean; visible: boolean }>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [msgRoman, setMsgRoman] = useState<Record<string, string>>({}); // id -> romanized text
  const romanReqRef = useRef<Set<string>>(new Set());

  // When the learner speaks/types ENGLISH, the right panel shows the corrected
  // target-language message + explanation + advanced grammar feedback.
  interface Coaching {
    id: string; english: string; corrected: string; explanation: string;
    advancedTopic: string; advancedDetail: string; loading: boolean;
  }
  const [coachings, setCoachings] = useState<Coaching[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const coachReqRef = useRef<Set<string>>(new Set());
  // Another response / Suggest reply
  const [regenLoading, setRegenLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestVisibleId, setSuggestVisibleId] = useState<string | null>(null); // show suggestions only after the user asks

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
  const bottomInputRef = useRef<HTMLInputElement>(null);

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

  // Most recent session, for the Resume card — only sessions created after
  // real per-user scoping was added are resumable (see backend user_id).
  useEffect(() => {
    if (!token) { setRecentSession(null); return; }
    let alive = true;
    getRecentSession(token)
      .then((r) => { if (alive) setRecentSession(r.session); })
      .catch(() => { if (alive) setRecentSession(null); });
    return () => { alive = false; };
  }, [token]);

  // Per-video due-word counts for the deck-picker badges, matching flashcards'
  // own DeckBrowser: a cheap vocabulary fetch cross-referenced against the
  // local FSRS review state (deliberately the same approximation flashcards
  // uses — this page has no per-video backend due-check of its own).
  const [deckDueCounts, setDeckDueCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!videos || !videos.length) return;
    let alive = true;
    Promise.all(
      videos.map(async (v) => {
        try {
          const res = await fetch(`${API_BASE_URL}/vocabulary/${v.video_id}?limit=20&lang=${language}`);
          if (!res.ok) return [v.video_id, 0] as const;
          const data = await res.json();
          const words: string[] = (data.vocabulary || []).map((w: { word: string }) => w.word);
          const deleted = getDeletedCards(language);
          const remaining = words.filter((w) => !deleted.has(w));
          return [v.video_id, getDueCards(remaining).length] as const;
        } catch {
          return [v.video_id, 0] as const;
        }
      }),
    ).then((entries) => {
      if (!alive) return;
      setDeckDueCounts(Object.fromEntries(entries));
    });
    return () => { alive = false; };
  }, [videos, language]);

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

  // ── romanize each AI message (target text written in English letters) ────────
  useEffect(() => {
    for (const m of messages) {
      if (m.role !== 'assistant') continue;
      const text = m.text.trim();
      if (!text || romanReqRef.current.has(m.id) || msgRoman[m.id] !== undefined) continue;
      romanReqRef.current.add(m.id);
      romanize(text, language)
        .then((r) => setMsgRoman((prev) => ({ ...prev, [m.id]: r })))
        .catch(() => setMsgRoman((prev) => ({ ...prev, [m.id]: '' })));
    }
  }, [messages, language, msgRoman]);

  // Detect English learner turns → coach how to say them in the target language.
  useEffect(() => {
    if (sessionId == null) return;
    for (const m of messages) {
      if (m.role !== 'user') continue;
      const text = m.text.trim();
      if (text.length < 2 || coachReqRef.current.has(m.id)) continue;
      if (!isLikelyEnglish(text, language)) continue;
      coachReqRef.current.add(m.id);
      setCoachings((prev) => [...prev, { id: m.id, english: text, corrected: '', explanation: '', advancedTopic: '', advancedDetail: '', loading: true }]);
      setAdvancedOpen(false);
      coachEnglish(sessionId, text, language)
        .then((r) => setCoachings((prev) => prev.map((c) => (c.id === m.id ? { ...c, corrected: r.corrected, explanation: r.explanation, advancedTopic: r.advanced_topic, advancedDetail: r.advanced_detail, loading: false } : c))))
        .catch(() => setCoachings((prev) => prev.map((c) => (c.id === m.id ? { ...c, loading: false } : c))));
    }
  }, [messages, language, sessionId]);

  // Speak a message aloud in the target language (Web Speech).
  const speak = useCallback((text: string) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ko-KR';
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, [language]);

  const copyMsg = useCallback((id: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    }).catch(() => {});
  }, []);

  // Toggle/lazy-load the English translation for one message.
  const toggleMsgTrans = useCallback((id: string, text: string, precomputed?: string) => {
    setMsgTrans((prev) => {
      const cur = prev[id];
      if (cur) return { ...prev, [id]: { ...cur, visible: !cur.visible } };
      return { ...prev, [id]: { text: precomputed, loading: !precomputed, visible: true } };
    });
    if (!msgTrans[id] && !precomputed) {
      translate(text, language)
        .then((t) => setMsgTrans((prev) => ({ ...prev, [id]: { text: t, loading: false, visible: true } })))
        .catch(() => setMsgTrans((prev) => ({ ...prev, [id]: { text: '—', loading: false, visible: true } })));
    }
  }, [msgTrans, language]);

  // Another response — regenerate the latest AI reply.
  const handleAnotherResponse = useCallback(async () => {
    if (sessionId == null || regenLoading) return;
    let targetId: string | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') { targetId = messages[i].id; break; }
    }
    if (!targetId) return;
    setRegenLoading(true);
    try {
      const r = await regenerateTurn(sessionId, language);
      const id = targetId;
      setMessages((prev) => prev.map((mm) => (mm.id === id ? {
        ...mm, text: r.reply, translation: r.reply_translation, correction: r.correction,
        turnId: r.turn_id, suggestedReplies: r.suggested_replies, targets: r.used_target_words || [],
      } : mm)));
      // clear caches so the new text re-romanizes / re-translates
      setMsgRoman((p) => { const n = { ...p }; delete n[id]; return n; });
      romanReqRef.current.delete(id);
      setMsgTrans((p) => { const n = { ...p }; delete n[id]; return n; });
    } catch {
      setChatError('Could not regenerate. Try again.');
    } finally {
      setRegenLoading(false);
    }
  }, [sessionId, language, regenLoading, messages]);

  // Suggest reply — fetch things the learner could say next.
  const handleSuggestReply = useCallback(async () => {
    if (sessionId == null || suggestLoading) return;
    setSuggestLoading(true);
    try {
      const r = await suggestReplies(sessionId, language);
      let li: string | null = null;
      for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'assistant') { li = messages[i].id; break; } }
      setMessages((prev) => prev.map((mm) => (mm.id === li ? { ...mm, suggestedReplies: r.suggested_replies } : mm)));
      setSuggestVisibleId(li);
    } catch { /* ignore */ } finally {
      setSuggestLoading(false);
    }
  }, [sessionId, language, suggestLoading, messages]);

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

  // Voice input is now Vercel's SpeechInput (speech → text → turn), so we do NOT
  // auto-start the live Gemini call. (Live-voice helpers are kept but unused.)

  // ── start a session from a chosen video ─────────────────────────────────────
  // Shared setup once a session has been created — resets every per-session
  // UI state and lands on the chat phase. Used by both a single-video start
  // and the mixed (due-words) start.
  const enterSession = useCallback((sessionId: number, finalWords: TargetWord[], initialMessages: ChatMessage[]) => {
    setTargetWords(finalWords);
    setUsedLemmas(new Set());
    setOpenTargetWord(null);
    setSavedWords([]);
    setCoachings([]); coachReqRef.current = new Set();
    setMsgRoman({}); romanReqRef.current = new Set();
    setMsgTrans({}); setCopiedId(null);
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
    setSessionId(sessionId);
    setStatus('Tap the mic and speak, or type');
    setMessages(initialMessages);
    setPhase('chat');
  }, []);

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
        words.push({ lemma, gloss: c.english || '', surface: (c.target_word || lemma).trim(), clipLine: c.sentence || undefined });
        if (words.length >= 8) break;
      }

      const result = await createSession({
        seed_type: 'video',
        video_id: video.video_id,
        seed_label: video.title,
        language,
        seed_words: words.map((w) => ({ lemma: w.lemma, gloss: w.gloss })),
      }, token);

      // Prefer the words we built (they carry surface forms for usage detection);
      // fall back to whatever the backend echoed.
      const finalWords: TargetWord[] = words.length
        ? words
        : (result.due_words || []).map((d: DueWord) => ({ lemma: d.lemma, gloss: d.gloss, surface: d.lemma }));

      enterSession(result.session_id, finalWords, [{
        id: `a-${result.opening.turn_id}`,
        role: 'assistant',
        text: result.opening.reply,
        translation: result.opening.reply_translation,
        turnId: result.opening.turn_id,
      }]);
    } catch {
      setChatError('Could not start the conversation. Please try again.');
      setPhase('deck');
    }
  }, [language, token, enterSession]);

  // "Mixed session" — the backend's own due_words seed type, which picks
  // words across every tracked video from its own review-due tracking
  // (independent of the flashcards feature's local FSRS state).
  const startMixedSession = useCallback(async () => {
    setDeck({ id: 'mixed', title: 'Mixed practice' });
    setPhase('loading');
    setChatError(null);
    try {
      const result = await createSession({ seed_type: 'due_words', language }, token);
      const finalWords: TargetWord[] = (result.due_words || []).map((d: DueWord) => ({
        lemma: d.lemma,
        gloss: d.gloss,
        surface: d.lemma,
      }));
      enterSession(result.session_id, finalWords, [{
        id: `a-${result.opening.turn_id}`,
        role: 'assistant',
        text: result.opening.reply,
        translation: result.opening.reply_translation,
        turnId: result.opening.turn_id,
      }]);
    } catch {
      setChatError('Could not start the conversation. Please try again.');
      setPhase('deck');
    }
  }, [language, token, enterSession]);

  // "Resume" — rehydrate a real prior session (turn history included) from
  // the backend's own storage. Only works for sessions created after
  // per-user scoping was added; recentSession is null for anyone without one.
  const resumeLastSession = useCallback(async () => {
    if (!recentSession || !token || resuming) return;
    setResuming(true);
    setChatError(null);
    try {
      const result = await resumeSession(recentSession.session_id, token);
      setDeck({ id: result.seed_video_id || 'mixed', title: result.seed_label || 'Voice Chat' });
      const finalWords: TargetWord[] = (result.due_words || []).map((d) => ({
        lemma: d.lemma,
        gloss: d.gloss,
        surface: d.lemma,
      }));
      enterSession(
        result.session_id,
        finalWords,
        result.turns.map((t) => ({
          id: `t-${t.turn_id}`,
          role: t.role,
          text: t.text,
          translation: t.reply_translation || undefined,
          correction: t.correction,
          turnId: t.turn_id,
          suggestedReplies: t.suggested_replies,
          targets: t.used_target_words,
        })),
      );
    } catch {
      setChatError('Could not resume that conversation. Please try again.');
    } finally {
      setResuming(false);
    }
  }, [recentSession, token, resuming, enterSession]);

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
    setSavedWords([]);
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
  const pickSuggestion = (es: string) => { setComposerText(es); setTimeout(() => bottomInputRef.current?.focus(), 60); };

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
  const latestCoaching = coachings.length ? coachings[coachings.length - 1] : null;

  // ============================================================================
  // Deck picker
  // ============================================================================
  const header = (back: () => void, label: string) => (
    <div className="flex items-center gap-3 mb-6">
      <NavigationIconButton direction="back" label={label} onClick={back} />
      <h1 className="font-heading text-section text-primary">AI chat</h1>
    </div>
  );

  if (phase === 'deck') {
    return (
      <div className="min-h-[calc(100vh-4rem)] max-w-4xl mx-auto">
        {header(() => onNavigate?.('practice'), 'Back to Practice')}

        {recentSession && (
          <section
            aria-labelledby="resume-title"
            className="mb-6 flex items-center gap-4 rounded-2xl bg-sage-soft p-4"
          >
            {recentSession.seed_video_id && !recentSession.seed_video_id.startsWith('netflix_') && (
              <img
                src={`https://img.youtube.com/vi/${recentSession.seed_video_id}/mqdefault.jpg`}
                alt=""
                loading="lazy"
                className="hidden h-16 w-24 shrink-0 rounded-lg object-cover sm:block"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 id="resume-title" className="truncate font-heading text-body font-semibold text-sage-deep">
                {recentSession.seed_label || 'Continue your conversation'}
              </h2>
              <p className="mt-0.5 truncate text-meta text-sage-ink">
                {recentSession.turn_count} {recentSession.turn_count === 1 ? 'message' : 'messages'}
                {recentSession.last_line ? ` · ${recentSession.last_line}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={resumeLastSession}
              disabled={resuming}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-body-sm font-semibold text-[#ffffff] disabled:opacity-60"
              style={{ background: ACCENT }}
            >
              {resuming ? <LoadingAnimation className="h-4 w-4" /> : <Play className="size-4" aria-hidden="true" />}
              Continue
            </button>
          </section>
        )}

        {chatError && (
          <div className="mb-4 text-sm font-medium" style={{ color: ACCENT }}>{chatError}</div>
        )}

        {videos !== null && videos.length > 0 && (
          <label className="relative mb-6 block">
            <span className="sr-only">Search videos</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={deckQuery}
              onChange={(e) => setDeckQuery(e.target.value)}
              placeholder="Search your videos"
              className="w-full rounded-xl border border-subtle bg-app py-2.5 pl-9 pr-3 text-body-sm text-primary placeholder:text-muted focus:outline-none"
              style={{ borderColor: 'var(--border-subtle)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
            />
          </label>
        )}

        {videos === null ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface rounded-2xl p-5 flex items-center gap-5">
                <Skeleton className="w-32 aspect-video rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          <PracticeEmptyState mode="AI chat" />
        ) : videos.filter((v) => v.title.toLowerCase().includes(deckQuery.trim().toLowerCase())).length === 0 ? (
          <p className="text-body-sm text-muted">Nothing matches "{deckQuery}".</p>
        ) : (
          <>
            <h2 className="mb-1 font-heading text-body font-semibold text-primary">Your videos</h2>
            <ul className="divide-y divide-[color:var(--border-subtle)] border-y border-subtle">
              {videos.filter((v) => v.title.toLowerCase().includes(deckQuery.trim().toLowerCase())).map((v, i) => {
                const isNetflix = v.video_id.startsWith('netflix_');
                return (
                  <motion.li
                    key={v.video_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <button
                      onClick={() => startFromVideo(v)}
                      className="group flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-hover flex items-center justify-center">
                        {isNetflix ? (
                          <Film className="w-4 h-4" style={{ color: ACCENT }} />
                        ) : (
                          <img
                            src={`https://img.youtube.com/vi/${v.video_id}/mqdefault.jpg`}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-primary">{v.title}</span>
                        <span className="mt-0.5 block text-meta text-muted">{isNetflix ? 'Netflix' : 'YouTube'}</span>
                      </span>
                      {(deckDueCounts[v.video_id] ?? 0) > 0 && (
                        <span className="hidden shrink-0 rounded-md bg-sage-soft px-2 py-1 text-meta font-medium text-sage-ink sm:block">
                          {deckDueCounts[v.video_id]} due
                        </span>
                      )}
                      <span className="shrink-0 rounded-md bg-sage-soft px-3 py-1.5 text-body-sm font-semibold text-sage-ink transition-colors group-hover:bg-sage-ink group-hover:text-[#ffffff]">
                        Start
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>

            <section
              aria-labelledby="mixed-title"
              className="mt-10 flex flex-col gap-4 rounded-2xl bg-sage-soft p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <h2 id="mixed-title" className="font-heading text-body font-semibold text-sage-deep">
                  Mixed session
                </h2>
                <p className="mt-0.5 text-body-sm text-sage-ink">
                  Practice a mix of words pulled from across your videos.
                </p>
              </div>
              <button
                type="button"
                onClick={startMixedSession}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-app px-4 py-2.5 text-body-sm font-semibold text-sage-deep hover:bg-surface-hover transition-colors"
              >
                <Shuffle className="size-4" style={{ color: ACCENT }} aria-hidden="true" />
                Start
              </button>
            </section>
          </>
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
        <div className="mt-10 flex flex-col items-center gap-3 text-sm text-muted" role="status" aria-live="polite">
          <LoadingAnimation className="h-[68px] w-[68px]" />
          <span>Starting your conversation…</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Chat
  // ============================================================================
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto">
      {/* header — spans the full width here, wider than the reading column below (matches MP) */}
      <div className="shrink-0 border-b border-subtle">
        <div className="flex h-16 items-center gap-4">
          <NavigationIconButton direction="back" label="Back to videos" onClick={() => setShowLeaveConfirm(true)} className="shrink-0" />

          <span className="hidden h-9 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-hover items-center justify-center sm:flex">
            {deck?.id.startsWith('netflix_') ? (
              <Film className="w-4 h-4" style={{ color: ACCENT }} />
            ) : deck?.id ? (
              <img
                src={`https://img.youtube.com/vi/${deck.id}/mqdefault.jpg`}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : null}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate font-heading font-semibold text-sm text-primary">
              {deck?.title || 'Voice Chat'}
            </h1>
          </div>

          {targetWords.length > 0 && (
            <div className="hidden items-center gap-3 md:flex">
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {targetWords.map((w) => {
                  const done = usedLemmas.has(w.lemma);
                  return (
                    <motion.span
                      key={w.lemma}
                      animate={done ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                      transition={{ duration: 0.26, ease: [0.23, 1, 0.32, 1] }}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: done ? ACCENT : 'var(--bg-surface-hover)' }}
                    />
                  );
                })}
              </span>
              <p className="text-xs text-secondary">
                <span className="font-semibold text-primary tabular-nums">{usedCount}</span>/{targetWords.length} words
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCoachOpen((v) => !v)}
            aria-pressed={coachOpen}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors ${
              coachOpen ? 'bg-sage-soft text-sage-ink' : 'text-secondary hover:bg-surface-hover hover:text-primary'
            }`}
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Coach</span>
          </button>
        </div>
      </div>

      {/* transcript — the reading column stays narrower than the header above it (matches MP) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto -mx-1 px-1 py-2">
      <div className="max-w-2xl mx-auto space-y-6">
        {messages.map((m) => {
          if (m.role === 'user') {
            const usedHere = lemmasUsedIn(m.text, targetWords);
            return (
              <div key={m.id} className="flex flex-col items-end gap-1.5">
                <div className="max-w-[85%] text-xl leading-relaxed text-secondary text-right">
                  {m.text}
                </div>
                {usedHere.length > 0 && (
                  <span className="flex items-center gap-1 text-meta" style={{ color: ACCENT }}>
                    <Check className="size-3.5" aria-hidden="true" /> {usedHere.join(', ')}
                  </span>
                )}
              </div>
            );
          }
          const transVisible = isTransVisible(m.id);
          const revealed = revealedCorrections.has(m.id);
          const verdict = correctionVerdicts[m.id];
          const isLast = m.id === lastAssistantId;
          return (
            <div key={m.id} className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage-ink"
              >
                <MessageCircle className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
              <div className="max-w-[90%] text-xl leading-relaxed text-primary font-medium">
                <TappableText text={m.text} targets={m.targets} onWordTap={handleWordTap} />
              </div>
              {/* romanization — the sentence written in the English alphabet */}
              {msgRoman[m.id] ? (
                <div className="max-w-[90%] text-xl leading-relaxed text-muted">{msgRoman[m.id]}</div>
              ) : null}

              <div className="flex flex-col gap-2 w-full">
                {/* per-message actions */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="relative group">
                    <button
                      onClick={() => toggleMsgTrans(m.id, m.text, m.translation)}
                      aria-label="Translate"
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${msgTrans[m.id]?.visible ? 'bg-sage-soft text-sage-ink' : 'text-muted hover:text-primary hover:bg-surface-hover'}`}
                    >
                      <Languages className="w-4 h-4" />
                    </button>
                    <span className="pointer-events-none absolute left-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-primary text-app text-[11px] font-medium px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                      Translate
                    </span>
                  </span>
                  <span className="relative group">
                    <button
                      onClick={() => speak(m.text)}
                      aria-label="Listen"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="pointer-events-none absolute left-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-primary text-app text-[11px] font-medium px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                      Listen
                    </span>
                  </span>
                  {isLast && (
                    <>
                      <span className="relative group">
                        <button
                          onClick={handleAnotherResponse}
                          disabled={regenLoading}
                          aria-label="Another response"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors disabled:opacity-60"
                        >
                          {regenLoading ? <LoadingAnimation className="h-4 w-4" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                        <span className="pointer-events-none absolute left-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-primary text-app text-[11px] font-medium px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                          Another response
                        </span>
                      </span>
                      <span className="relative group">
                        <button
                          onClick={handleSuggestReply}
                          disabled={suggestLoading}
                          aria-label="Suggest reply"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors disabled:opacity-60"
                        >
                          {suggestLoading ? <LoadingAnimation className="h-4 w-4" /> : <MessageSquarePlus className="w-4 h-4" />}
                        </button>
                        <span className="pointer-events-none absolute left-0 top-full mt-1.5 whitespace-nowrap rounded-md bg-primary text-app text-[11px] font-medium px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                          Suggest reply
                        </span>
                      </span>
                    </>
                  )}
                </div>
                {msgTrans[m.id]?.visible && (
                  <div className="mt-2 border-l-2 border-subtle pl-3 text-sm text-secondary">
                    {msgTrans[m.id]?.loading ? 'Translating…' : (msgTrans[m.id]?.text || m.translation || '—')}
                  </div>
                )}

                {m.correction && (!revealed ? (
                  <button
                    onClick={() => setRevealedCorrections((prev) => new Set(prev).add(m.id))}
                    className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-secondary transition-colors"
                  >
                    <Lightbulb className="w-3.5 h-3.5" /> A better way to say that
                  </button>
                ) : (
                  <div className="rounded-2xl bg-surface p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">A better way to say that</div>
                    <div className="text-body font-medium text-primary" style={{ color: PAGE }}>{m.correction.correct}</div>
                    <div className="text-body-sm text-secondary mt-1.5">{m.correction.why_en}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        className={'text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ' + (verdict === 'fine' ? 'text-[#ffffff]' : 'bg-surface-hover text-secondary hover:text-primary')}
                        style={verdict === 'fine' ? { background: ACCENT } : undefined}
                        disabled={!!verdict}
                        onClick={() => handleCorrectionFb(m.id, m.turnId, 'fine')}
                      >
                        Mine was fine
                      </button>
                      <button
                        className={'text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ' + (verdict === 'wrong' ? 'text-[#ffffff]' : 'bg-surface-hover text-secondary hover:text-primary')}
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

                {isLast && suggestVisibleId === m.id && m.suggestedReplies && m.suggestedReplies.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-2xl border border-subtle bg-surface">
                    <ul className="divide-y divide-[color:var(--border-subtle)]">
                      {m.suggestedReplies.slice(0, 3).map((s, i) => (
                        <li key={i}>
                          <button
                            onClick={() => pickSuggestion(s.es)}
                            className="flex w-full items-baseline gap-3 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors"
                          >
                            <kbd
                              aria-hidden="true"
                              className="grid h-5 w-5 shrink-0 translate-y-0.5 place-items-center rounded-md bg-surface-hover text-[11px] font-medium text-muted"
                            >
                              {i + 1}
                            </kbd>
                            <span className="min-w-0 flex-1 text-sm font-medium text-primary">{s.es}</span>
                            {s.en && <span className="hidden shrink-0 text-xs text-muted sm:block">{s.en}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-end border-t border-subtle px-2 py-1.5">
                      <button
                        onClick={() => setSuggestVisibleId(null)}
                        aria-label="Dismiss suggestions"
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-primary transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>
          );
        })}

        {sending && (
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage-ink"
            >
              <MessageCircle className="h-4 w-4" />
            </div>
            <span className="flex items-center gap-1.5" role="status" aria-live="polite">
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="h-1.5 w-1.5 rounded-full bg-sage-ink"
                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear', delay: dot * 0.14 }}
                />
              ))}
              <span className="sr-only">Tutor is writing</span>
            </span>
          </div>
        )}
      </div>
      </div>

      {/* dock */}
      <div className="shrink-0 pt-3">
      <div className="max-w-2xl mx-auto">
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
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-[#ffffff] disabled:opacity-50"
                  style={{ background: ACCENT }}
                >
                  {howtoLoading ? <LoadingAnimation className="h-4 w-4" /> : 'Translate'}
                </button>
              </div>
              {howtoResult && howtoResult.spanish && (
                <div className="mt-3 rounded-lg bg-app p-3">
                  <div className="text-sm font-medium text-primary">{howtoResult.spanish}</div>
                  {howtoResult.note_en && <div className="text-xs text-muted mt-1">{howtoResult.note_en}</div>}
                  <button
                    onClick={() => pickSuggestion(howtoResult!.spanish)}
                    className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg text-[#ffffff]"
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

        <div className="mt-3 rounded-2xl border border-subtle bg-surface p-2 focus-within:border-medium transition-colors">
          <input
            ref={bottomInputRef}
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTextTurn(); } }}
            placeholder={`Type in ${langName}…`}
            aria-label="Type a message"
            className="w-full resize-none bg-transparent px-3 pb-1 pt-2 text-[15px] text-primary placeholder:text-muted outline-none"
          />

          <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-1">
            <SpeechInput
              lang={language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ko-KR'}
              onTranscriptionChange={(t) => { const x = (t || '').trim(); if (x) sendTextTurn(x); }}
              title="Speak"
              aria-label="Speak"
              className="w-9 h-9 p-0 rounded-full bg-sage-soft text-sage-ink hover:bg-sage-ink hover:text-app shadow-none"
            />

            <button
              onClick={() => sendTextTurn()}
              disabled={!composerText.trim() || sending}
              title="Send"
              aria-label="Send"
              className="w-10 h-10 flex items-center justify-center rounded-xl disabled:opacity-40 disabled:bg-surface-hover disabled:text-muted transition-colors"
              style={composerText.trim() && !sending ? { background: ACCENT, color: '#ffffff' } : undefined}
            >
              {sending ? <LoadingAnimation className="h-4 w-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-muted mt-2 h-4">
          {voiceError ? <span style={{ color: ACCENT }}>{voiceError}</span>
            : chatError ? <span style={{ color: ACCENT }}>{chatError}</span>
            : status}
        </div>
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
                You can pick up where you left off from the Resume card next time you come back.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={leaveChat}
                  className="w-full px-4 py-2.5 rounded-xl text-[#ffffff] font-semibold text-sm"
                  style={{ background: ACCENT }}
                >
                  Leave
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

      {/* word popover — tapped word + its English meaning + save */}
      {pop && (
        <span
          className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl bg-primary text-app shadow-xl"
          style={{ left: pop.x, top: pop.y - 10, maxWidth: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block px-3 py-2">
            <span className="block text-sm font-bold">{pop.word}</span>
            <span className="block text-[11px] uppercase tracking-wide opacity-60 mt-1">English meaning</span>
            <span className="block text-sm opacity-90">
              {pop.loading ? 'Translating…' : (pop.text || '—')}
            </span>
            {!pop.loading && pop.text && (() => {
              const isSaved = savedWords.some((w) => w.lemma.toLowerCase() === pop.word.toLowerCase());
              return (
                <button
                  type="button"
                  onClick={() => saveWord(pop.word, pop.text)}
                  disabled={isSaved}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[rgba(255,255,255,0.12)] px-2 py-1 text-[11px] font-medium hover:bg-[rgba(255,255,255,0.2)] disabled:opacity-70"
                >
                  {isSaved ? <Check className="w-3 h-3" aria-hidden="true" /> : <BookmarkPlus className="w-3 h-3" aria-hidden="true" />}
                  {isSaved ? 'Saved' : 'Save word'}
                </button>
              );
            })()}
          </span>
        </span>
      )}

      {/* Coach drawer — target words with clip context, plus English-fallback coaching */}
      <AnimatePresence>
        {coachOpen && (
          <motion.aside
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            aria-label="Session coach"
            className="fixed inset-y-0 right-0 z-20 flex w-[340px] max-w-full flex-col border-l border-subtle bg-app shadow-2xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-subtle px-5">
              <h2 className="font-heading text-body font-semibold text-primary">Coach</h2>
              <button
                type="button"
                onClick={() => setCoachOpen(false)}
                aria-label="Close coach panel"
                className="grid size-9 place-items-center rounded-lg text-secondary hover:bg-surface-hover hover:text-primary"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {targetWords.length > 0 && (
                <section className="rounded-2xl border border-subtle bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-hover flex items-center justify-center">
                      {deck?.id.startsWith('netflix_') ? (
                        <Film className="w-4 h-4" style={{ color: ACCENT }} />
                      ) : deck?.id ? (
                        <img
                          src={`https://img.youtube.com/vi/${deck.id}/mqdefault.jpg`}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-primary">{deck?.title}</p>
                      <p className="truncate text-meta text-muted">{deck?.id.startsWith('netflix_') ? 'Netflix' : 'YouTube'}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-card-title text-primary">
                    {usedCount}
                    <span className="text-body font-normal text-muted">/{targetWords.length} words used</span>
                  </p>

                  <ul className="mt-3">
                    {targetWords.map((w) => {
                      const done = usedLemmas.has(w.lemma);
                      const open = openTargetWord === w.lemma;
                      return (
                        <li key={w.lemma}>
                          <button
                            type="button"
                            onClick={() => setOpenTargetWord(open ? null : w.lemma)}
                            aria-expanded={open}
                            className="flex w-full items-center justify-between gap-3 py-1.5 text-left"
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                aria-hidden="true"
                                className="grid size-5 shrink-0 place-items-center rounded-full border transition-colors"
                                style={done ? { background: ACCENT, borderColor: ACCENT, color: '#ffffff' } : { borderColor: 'var(--border-medium)' }}
                              >
                                {done && <Check className="size-3.5" />}
                              </span>
                              <span className={`truncate text-body-sm ${done ? 'font-medium text-primary' : 'text-secondary'}`}>
                                {w.lemma}
                              </span>
                            </span>
                            <span className="shrink-0 text-meta text-muted">{w.gloss}</span>
                          </button>

                          <AnimatePresence initial={false}>
                            {open && w.clipLine && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                                className="overflow-hidden"
                              >
                                <p className="ml-7 border-l-2 border-subtle py-1 pl-3 text-meta text-secondary">
                                  "{w.clipLine}"
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <section className="mt-7">
                <h3 className="text-body-sm font-semibold text-primary">Fixes</h3>
                {(() => {
                  // correction lives on the assistant turn (feedback about the user
                  // turn right before it), so "said" comes from that prior message.
                  const corrections = messages
                    .map((m, i) => ({ m, said: i > 0 ? messages[i - 1].text : '' }))
                    .filter(({ m }) => m.role === 'assistant' && m.correction);
                  return corrections.length === 0 ? (
                    <p className="mt-1.5 text-body-sm text-muted">Nothing yet.</p>
                  ) : (
                    <ul className="mt-2.5 space-y-2.5">
                      {corrections.map(({ m, said }) => (
                        <li key={m.id} className="border-l-2 border-subtle pl-3">
                          <p className="text-meta text-muted line-through">{said}</p>
                          <p className="mt-0.5 text-body-sm font-medium text-primary">{m.correction!.correct}</p>
                          <p className="mt-0.5 text-meta text-secondary">{m.correction!.why_en}</p>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </section>

              <section className="mt-7">
                <h3 className="text-body-sm font-semibold text-primary">Saved words</h3>
                {savedWords.length === 0 ? (
                  <p className="mt-1.5 text-body-sm text-muted">Tap a word to save it.</p>
                ) : (
                  <ul className="mt-2.5 flex flex-wrap gap-2">
                    {savedWords.map((word) => (
                      <li key={word.lemma} className="rounded-md border border-subtle px-2.5 py-1.5 text-meta">
                        <span className="font-medium text-primary">{word.lemma}</span>
                        <span className="text-muted"> · {word.gloss}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {latestCoaching && (
                <section className="mt-7">
                  <h3 className="text-body-sm font-semibold text-primary">Said in English</h3>
                  <p className="mt-2 text-lead font-medium text-primary">
                    {latestCoaching.loading ? '…' : (latestCoaching.corrected || '—')}
                  </p>

                  {!latestCoaching.loading && latestCoaching.explanation && (
                    <div className="mt-3 rounded-2xl p-4" style={{ background: PAGE }}>
                      <p className="text-meta font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        Explanation
                      </p>
                      <p className="mt-2 text-body-sm leading-relaxed text-[#ffffff]">
                        {latestCoaching.explanation}
                      </p>
                      {latestCoaching.advancedDetail && (
                        <button
                          type="button"
                          onClick={() => setAdvancedOpen((v) => !v)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#ffffff] px-3 py-1.5 text-body-sm font-semibold"
                          style={{ color: PAGE }}
                        >
                          <Sparkles className="w-4 h-4" aria-hidden="true" /> Advanced feedback
                        </button>
                      )}
                    </div>
                  )}

                  {advancedOpen && latestCoaching.advancedDetail && (
                    <div className="mt-4 border-t border-subtle pt-4">
                      {latestCoaching.advancedTopic && (
                        <h4 className="font-heading font-bold text-primary" style={{ color: PAGE }}>{latestCoaching.advancedTopic}</h4>
                      )}
                      <p className="mt-2 text-body-sm leading-relaxed text-primary">{latestCoaching.advancedDetail}</p>
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="shrink-0 border-t border-subtle p-4">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full rounded-xl px-4 py-2.5 text-body-sm font-semibold text-[#ffffff] transition-colors"
                style={{ background: ACCENT }}
              >
                End session
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
