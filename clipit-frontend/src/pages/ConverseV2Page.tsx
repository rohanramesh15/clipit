import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Film, Search, Shuffle, Play, ChevronDown, ExternalLink,
} from 'lucide-react';
import {
  getProfile, createSession, sendTurn, romanize,
  correctionFeedback, voiceWsUrl, coachEnglish, regenerateTurn, suggestReplies,
  getRecentSession, getMixedSources, resumeSession, setSessionTargetWords,
  type Profile, type DueWord,
  type RecentSession, type MixedSourceVideo,
} from '../services/converseV2';
import {
  fetchVideoCards,
  type TrackedVideo, type FlashCard,
} from '../services/madlibs';
import { VoiceSession, VoiceEvent } from '../lib/voiceSession';
import { getDueCards } from '../services/fsrs';
import { getDeletedCards, relativeDay } from '../utils/flashcardStorage';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PracticeEmptyState } from '../components/PracticeEmptyState';
import { Skeleton } from '../components/Skeleton';
import { LoadingAnimation } from '../components/LoadingAnimation';
import { NavigationIconButton } from '../components/NavigationIconButton';
import { queryClient } from '../lib/queryClient';
import { historyQueryOptions, queryKeys, type VideoVocabulary, videoVocabularyQueryOptions } from '../lib/queries';
import { mapWithConcurrency } from '../lib/network';
import { lemmasUsedIn } from '../lib/targetWords';
import type { ChatMessage, SavedWord, TargetWord } from '../types/chat';
import { SessionHeader } from '../components/chat/SessionHeader';
import { VoiceStage } from '../components/chat/VoiceStage';
import { VoiceControls } from '../components/chat/VoiceControls';
import type { OrbState } from '../components/chat/VoiceOrb';
import { Composer } from '../components/chat/Composer';
import { MessageList } from '../components/chat/MessageList';
import { SuggestionPanel } from '../components/chat/SuggestionPanel';
import { CoachDrawer } from '../components/chat/CoachDrawer';

type Phase = 'deck' | 'chat' | 'empty';
type VoiceStatus = 'off' | 'connecting' | 'listening' | 'speaking';
type NavPage = 'video' | 'practice' | 'flashcards' | 'analytics' | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';
type DeckSort = 'due' | 'recent';

const DECK_PAGE_SIZE = 5;
const SESSION_QUERY_PARAM = 'session';
const deckSorts: { value: DeckSort; label: string }[] = [
  { value: 'due', label: 'Most due' },
  { value: 'recent', label: 'Recently watched' },
];

function sessionIdFromLocation(): number | null {
  const value = new URLSearchParams(window.location.search).get(SESSION_QUERY_PARAM);
  if (!value || !/^\d+$/.test(value)) return null;
  const sessionId = Number(value);
  return Number.isSafeInteger(sessionId) && sessionId > 0 ? sessionId : null;
}

function setConversationSessionInUrl(sessionId: number | null) {
  const url = new URL(window.location.href);
  if (sessionId === null) url.searchParams.delete(SESSION_QUERY_PARAM);
  else url.searchParams.set(SESSION_QUERY_PARAM, String(sessionId));
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
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

// Random, order-independent sample — used to pick which of a mixed session's
// source videos show as thumbnails in the chat header.
function sampleRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length && picked.length < count) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

// ==============================================================================
// Main page
// ==============================================================================

export function ConverseV2Page(
  { onBack, onNavigate, onImmersiveChange }: {
    onBack?: () => void;
    onNavigate?: (page: NavPage) => void;
    // Fires whenever the chat phase (which renders its own back control and
    // header) starts or stops, so the app shell can hide the top nav to match.
    onImmersiveChange?: (immersive: boolean) => void;
  } = {},
) {
  const { user, token } = useAuth();
  const { language } = useLanguage();
  const langName = LANG_NAMES[language] || 'Korean';
  const requestedSessionId = useRef(sessionIdFromLocation());
  const [isRestoringSession, setIsRestoringSession] = useState(() => requestedSessionId.current !== null);

  const [phase, setPhase] = useState<Phase>('deck');
  useEffect(() => { onImmersiveChange?.(phase === 'chat'); }, [phase, onImmersiveChange]);
  const [profile, setProfile] = useState<Profile | null>(null);

  // deck picker
  const [videos, setVideos] = useState<TrackedVideo[] | null>(null);
  const [recentSession, setRecentSession] = useState<RecentSession | null>(null);
  const [resuming, setResuming] = useState(false);
  const [deckQuery, setDeckQuery] = useState('');
  const [mixedSources, setMixedSources] = useState<MixedSourceVideo[]>([]);
  const [deckSort, setDeckSort] = useState<DeckSort>('due');
  const [isDeckSortOpen, setIsDeckSortOpen] = useState(false);
  const [visibleDecks, setVisibleDecks] = useState(DECK_PAGE_SIZE);
  const deckSortRef = useRef<HTMLDivElement>(null);

  // active session
  const [deck, setDeck] = useState<{ id: string; title: string } | null>(null);
  // Mixed-practice sessions draw from several videos — a random sample shown
  // stacked in the chat header instead of a single thumbnail.
  const [mixedThumbs, setMixedThumbs] = useState<MixedSourceVideo[]>([]);
  const [targetWords, setTargetWords] = useState<TargetWord[]>([]);
  const [usedLemmas, setUsedLemmas] = useState<Set<string>>(new Set());
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // True from the moment the chat shell appears until the real opening line
  // (an LLM call) resolves — lets the composer/header render immediately
  // instead of sitting on a blank "Starting your conversation…" screen.
  const [openingPending, setOpeningPending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Closed by default: the drawer overlays the chat at every width here (there's
  // no MP-style xl-and-up sidebar variant), so auto-opening it would cover the
  // conversation immediately on a narrower screen.
  const [coachOpen, setCoachOpen] = useState(false);
  const [openTargetWord, setOpenTargetWord] = useState<string | null>(null);
  // Call view (voice-first) is the default; Transcript is opt-in history.
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  // text composer — voice controls are the default, typing is a fallback.
  const [typing, setTyping] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [revealedCorrections, setRevealedCorrections] = useState<Set<string>>(new Set());
  const [correctionVerdicts, setCorrectionVerdicts] = useState<Record<string, 'fine' | 'wrong'>>({});
  const [status, setStatus] = useState('');

  // Words saved from the tap-word popover — session-scoped, matching MP's own
  // (also purely in-memory, never persisted) saved-words feature.
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const saveWord = useCallback((lemma: string, gloss: string) => {
    setSavedWords((prev) => (prev.some((w) => w.lemma.toLowerCase() === lemma.toLowerCase()) ? prev : [...prev, { lemma, gloss }]));
  }, []);

  // per-AI-message romanization
  const [msgRoman, setMsgRoman] = useState<Record<string, string>>({}); // id -> romanized text
  const romanReqRef = useRef<Set<string>>(new Set());

  // When the learner speaks/types ENGLISH, the coach drawer shows the corrected
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
  const speakingRef = useRef(false);
  const voiceRef = useRef<VoiceSession | null>(null);
  const vUserId = useRef<string | null>(null);
  const vAsstId = useRef<string | null>(null);
  // Tracks which session is currently on screen, so a target-word lookup
  // that resolves after the user has already left (or started a different
  // session) can tell it's stale and skip applying itself.
  const activeSessionRef = useRef<number | null>(null);

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
    if (!user || !token) {
      setVideos([]);
      return;
    }
    let alive = true;
    const historyKey = queryKeys.history(user.id, language);
    const cached = queryClient.getQueryData<TrackedVideo[]>(historyKey);
    setVideos(cached ?? null);
    void queryClient.ensureQueryData(historyQueryOptions(user.id, token, language))
      .then((videos) => { if (alive) setVideos(videos); })
      .catch(() => { if (alive && !cached) setVideos([]); });
    return () => { alive = false; };
  }, [language, token, user]);

  // Most recent session, for the Resume card — only sessions created after
  // real per-user scoping was added are resumable (see backend user_id).
  // Re-fetches every time the dashboard is shown (not just on mount), so a
  // session you just left shows up in the Resume card without a page reload.
  useEffect(() => {
    if (phase !== 'deck') return;
    if (!token) { setRecentSession(null); return; }
    let alive = true;
    getRecentSession(token)
      .then((r) => { if (alive) setRecentSession(r.session); })
      .catch(() => { if (alive) setRecentSession(null); });
    return () => { alive = false; };
  }, [phase, token]);

  useEffect(() => {
    if (phase !== 'deck' || !token) {
      setMixedSources([]);
      return;
    }
    let alive = true;
    getMixedSources(language, token)
      .then((result) => { if (alive) setMixedSources(result.videos); })
      .catch(() => { if (alive) setMixedSources([]); });
    return () => { alive = false; };
  }, [language, phase, token]);

  // Per-video word lists provide the same word-count and due-count metadata as
  // Flashcards' deck browser. Due state is the same local-FSRS approximation
  // used there; the lists themselves are not shown in this picker.
  const [deckWords, setDeckWords] = useState<Record<string, string[]>>({});
  const deckDueCounts = useMemo(
    () => {
      const deleted = getDeletedCards(language);
      return Object.fromEntries(Object.entries(deckWords).map(([id, words]) => {
        const remaining = words.filter((word) => !deleted.has(word));
        return [id, getDueCards(remaining).length];
      }));
    },
    [deckWords, language],
  );
  useEffect(() => {
    function closeDeckSort(event: PointerEvent) {
      if (deckSortRef.current && !deckSortRef.current.contains(event.target as Node)) setIsDeckSortOpen(false);
    }
    function closeDeckSortOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsDeckSortOpen(false);
    }
    document.addEventListener('pointerdown', closeDeckSort);
    document.addEventListener('keydown', closeDeckSortOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeDeckSort);
      document.removeEventListener('keydown', closeDeckSortOnEscape);
    };
  }, []);
  useEffect(() => {
    if (!videos?.length || !user || !token) return;
    let alive = true;
    const cachedWords = Object.fromEntries(
      videos.flatMap((video) => {
        const cached = queryClient.getQueryData<VideoVocabulary>(
          queryKeys.videoVocabulary(user.id, language, video.video_id),
        );
        return cached ? [[video.video_id, cached.words] as const] : [];
      }),
    );
    setDeckWords(cachedWords);

    const missing = videos.filter((video) => cachedWords[video.video_id] === undefined);
    void mapWithConcurrency(missing, 2, async (video) => {
      try {
        const vocabulary = await queryClient.fetchQuery(
          videoVocabularyQueryOptions(user.id, token, language, video.video_id),
        );
        if (alive) setDeckWords((current) => ({ ...current, [video.video_id]: vocabulary.words }));
      } catch {
        if (alive) setDeckWords((current) => ({ ...current, [video.video_id]: [] }));
      }
    });
    return () => { alive = false; };
  }, [videos, language, token, user]);

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
      coachEnglish(sessionId, text, language, token)
        .then((r) => setCoachings((prev) => prev.map((c) => (c.id === m.id ? { ...c, corrected: r.corrected, explanation: r.explanation, advancedTopic: r.advanced_topic, advancedDetail: r.advanced_detail, loading: false } : c))))
        .catch(() => setCoachings((prev) => prev.map((c) => (c.id === m.id ? { ...c, loading: false } : c))));
    }
  }, [messages, language, sessionId, token]);

  // Speak a message aloud in the target language (Web Speech). onStart/onEnd
  // let the message that requested it reflect real speaking state instead of
  // a canned timeout.
  const speak = useCallback((text: string, onStart?: () => void, onEnd?: () => void) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === 'uk' ? 'uk-UA' : language === 'en' ? 'en-US' : 'ko-KR';
      u.rate = 0.9;
      if (onStart) u.onstart = onStart;
      if (onEnd) { u.onend = onEnd; u.onerror = onEnd; }
      window.speechSynthesis.speak(u);
    } catch {
      onEnd?.();
    }
  }, [language]);

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
      const r = await regenerateTurn(sessionId, language, token);
      const id = targetId;
      setMessages((prev) => prev.map((mm) => (mm.id === id ? {
        ...mm, text: r.reply, translation: r.reply_translation, correction: r.correction,
        turnId: r.turn_id, suggestedReplies: r.suggested_replies, targets: r.used_target_words || [],
      } : mm)));
      // clear the cache so the new text re-romanizes
      setMsgRoman((p) => { const n = { ...p }; delete n[id]; return n; });
      romanReqRef.current.delete(id);
    } catch {
      setChatError('Could not regenerate. Try again.');
    } finally {
      setRegenLoading(false);
    }
  }, [sessionId, language, regenLoading, messages, token]);

  // Suggest reply — fetch things the learner could say next.
  const handleSuggestReply = useCallback(async () => {
    if (sessionId == null || suggestLoading) return;
    setSuggestLoading(true);
    try {
      const r = await suggestReplies(sessionId, language, token);
      let li: string | null = null;
      for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'assistant') { li = messages[i].id; break; } }
      setMessages((prev) => prev.map((mm) => (mm.id === li ? { ...mm, suggestedReplies: r.suggested_replies } : mm)));
      setSuggestVisibleId(li);
    } catch { /* ignore */ } finally {
      setSuggestLoading(false);
    }
  }, [sessionId, language, suggestLoading, messages, token]);

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
      case 'ready': speakingRef.current = false; setVoiceStatus('listening'); setStatus('Listening… just talk'); return;
      case 'speaking_changed':
        speakingRef.current = e.speaking;
        setVoiceStatus(e.speaking ? 'speaking' : 'listening');
        setStatus(e.speaking ? 'Tutor is speaking…' : 'Your turn — just talk');
        return;
      case 'mic_level': case 'speaker_level': return;
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
      case 'error': speakingRef.current = false; setVoiceError(e.message); setVoiceStatus('off'); setStatus(''); return;
      case 'closed': vUserId.current = null; vAsstId.current = null; speakingRef.current = false; setVoiceStatus('off'); return;
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
    setVoiceStatus('off');
    setStatus('Tap the mic to talk, or the keyboard to type');
  }, []);

  useEffect(() => () => { voiceRef.current?.stop(); voiceRef.current = null; }, []);

  // ── start a session from a chosen video ─────────────────────────────────────
  // Shared setup once a session has been created — resets every per-session
  // UI state and lands on the chat phase. Used by both a single-video start
  // and the mixed (due-words) start.
  const resetSessionUI = useCallback(() => {
    setMixedThumbs([]);
    setTargetWords([]);
    setUsedLemmas(new Set());
    setOpenTargetWord(null);
    setSavedWords([]);
    setCoachings([]); coachReqRef.current = new Set();
    setMsgRoman({}); romanReqRef.current = new Set();
    setRevealedCorrections(new Set());
    setCorrectionVerdicts({});
    setSuggestVisibleId(null);
    setTyping(false);
    setTranscriptOpen(false);
    setComposerText('');
    setVoiceStatus('off');
    setVoiceError(null);
  }, []);

  // Shows the chat shell (header, composer) right away, with a typing
  // indicator standing in for the opening line, instead of a blank loading
  // screen for however long that line's LLM call takes.
  const enterChatShell = useCallback(() => {
    activeSessionRef.current = null;
    resetSessionUI();
    setSessionId(null);
    setStatus('Tap the mic and speak, or type');
    setMessages([]);
    setOpeningPending(true);
    setPhase('chat');
  }, [resetSessionUI]);

  const enterSession = useCallback((sessionId: number, finalWords: TargetWord[], initialMessages: ChatMessage[]) => {
    activeSessionRef.current = sessionId;
    resetSessionUI();
    setTargetWords(finalWords);
    setSessionId(sessionId);
    setStatus('Tap the mic and speak, or type');
    setMessages(initialMessages);
    setOpeningPending(false);
    setPhase('chat');
    setConversationSessionInUrl(sessionId);
  }, [resetSessionUI]);

  const startFromVideo = useCallback(async (video: TrackedVideo) => {
    setDeck({ id: video.video_id, title: video.title });
    setChatError(null);
    enterChatShell();
    try {
      // The opening line only needs the video title (see generate_opening's
      // "video" branch), not the resolved target words — so show it as soon
      // as it's ready instead of waiting on the slower, translation-heavy
      // word lookup first.
      const result = await createSession({
        seed_type: 'video',
        video_id: video.video_id,
        seed_label: video.title,
        language,
      }, token);

      enterSession(result.session_id, [], [{
        id: `a-${result.opening.turn_id}`,
        role: 'assistant',
        text: result.opening.reply,
        translation: result.opening.reply_translation,
        turnId: result.opening.turn_id,
      }]);

      // Target words load in the background and fill in once ready — the
      // conversation is already usable before this resolves. If the user has
      // since left or started a different session, skip applying it.
      try {
        // Only 8 words are kept below, so only fetch/translate a small
        // buffer above that (some get dropped for missing a lemma) instead
        // of the 30-word pool Mad Libs needs.
        const cards: FlashCard[] = await fetchVideoCards(video.video_id, language, 12);
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
        if (words.length && activeSessionRef.current === result.session_id) {
          setTargetWords(words);
          void setSessionTargetWords(result.session_id, words.map((w) => ({ lemma: w.lemma, gloss: w.gloss })), token);
        }
      } catch {
        // Target words are a nice-to-have on top of an already-usable chat;
        // a failure here shouldn't surface as a session-start error.
      }
    } catch {
      setChatError('Could not start the conversation. Please try again.');
      setPhase('deck');
    }
  }, [language, token, enterChatShell, enterSession]);

  // "Mixed session" — the backend's own due_words seed type, which picks
  // words across every tracked video from its own review-due tracking
  // (independent of the flashcards feature's local FSRS state).
  const startMixedSession = useCallback(async () => {
    setDeck({ id: 'mixed', title: 'Mixed practice' });
    setChatError(null);
    enterChatShell();
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
      // enterSession resets per-session UI state (including this), so set it
      // after — a random sample of what this session actually draws from.
      setMixedThumbs(sampleRandom(result.source_videos || [], 3));
    } catch {
      setChatError('Could not start the conversation. Please try again.');
      setPhase('deck');
    }
  }, [language, token, enterChatShell, enterSession]);

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

  // A conversation URL contains the server-side session ID, so refreshing an
  // active chat can rehydrate its turns rather than dropping the learner back
  // at the deck dashboard. The backend checks ownership before returning it.
  useEffect(() => {
    const requestedId = requestedSessionId.current;
    if (!isRestoringSession || requestedId === null || !token) return;
    let alive = true;

    void resumeSession(requestedId, token)
      .then((result) => {
        if (!alive) return;
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
      })
      .catch(() => {
        if (!alive) return;
        setConversationSessionInUrl(null);
        setChatError('Could not restore that conversation.');
        setPhase('deck');
      })
      .finally(() => {
        if (alive) setIsRestoringSession(false);
      });

    return () => { alive = false; };
  }, [enterSession, isRestoringSession, token]);

  const leaveChat = useCallback(() => {
    activeSessionRef.current = null;
    voiceRef.current?.stop();
    voiceRef.current = null;
    vUserId.current = null;
    vAsstId.current = null;
    setVoiceStatus('off');
    setVoiceError(null);
    setSessionId(null);
    setMessages([]);
    setTargetWords([]);
    setUsedLemmas(new Set());
    setSavedWords([]);
    setTyping(false);
    setComposerText('');
    setTranscriptOpen(false);
    setSuggestVisibleId(null);
    setPhase('deck');
    setConversationSessionInUrl(null);
  }, []);

  // ── chat actions ────────────────────────────────────────────────────────────
  const sendTextTurn = useCallback(async (override?: string) => {
    const text = (override ?? composerText).trim();
    if (!text || sending || sessionId == null) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setComposerText('');
    setSuggestVisibleId(null);
    setSending(true);
    setStatus('Tutor is writing…');
    try {
      const result = await sendTurn(sessionId, text, language, token);
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
  }, [composerText, sending, sessionId, language, token]);

  const handleCorrectionFb = useCallback(async (messageId: string, turnId: number | undefined, verdict: 'fine' | 'wrong') => {
    if (turnId == null || correctionVerdicts[messageId]) return;
    setCorrectionVerdicts((prev) => ({ ...prev, [messageId]: verdict }));
    try { await correctionFeedback(turnId, verdict); } catch { /* keep optimistic */ }
  }, [correctionVerdicts]);

  const tutorTurn = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant'), [messages]);
  const lastUserTurn = useMemo(() => [...messages].reverse().find((m) => m.role === 'user'), [messages]);
  // Live in-progress transcript of what the mic is currently hearing — the
  // in-flight voice message's text, while it's still being appended to.
  const heard = voiceStatus === 'listening' ? (messages.find((m) => m.id === vUserId.current)?.text ?? '') : '';
  const tutorBusy = sending || openingPending;
  const orbState: OrbState = tutorBusy
    ? 'thinking'
    : voiceStatus === 'speaking' ? 'speaking'
    : voiceStatus === 'listening' || voiceStatus === 'connecting' ? 'listening'
    : 'idle';
  const tutorInitial = langName.charAt(0).toUpperCase();
  const activeSuggestions = useMemo(
    () => messages.find((m) => m.id === suggestVisibleId)?.suggestedReplies ?? [],
    [messages, suggestVisibleId],
  );

  const usedCount = usedLemmas.size;
  const latestCoaching = coachings.length ? coachings[coachings.length - 1] : null;
  const currentDeckSort = deckSorts.find((option) => option.value === deckSort) ?? deckSorts[0];
  const matchingDecks = useMemo(() => {
    const needle = deckQuery.trim().toLowerCase();
    return (videos ?? [])
      .filter((video) => !needle || video.title.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (deckSort === 'due') return (deckDueCounts[b.video_id] ?? 0) - (deckDueCounts[a.video_id] ?? 0);
        return b.tracked_at - a.tracked_at;
      });
  }, [deckDueCounts, deckQuery, deckSort, videos]);
  const shownDecks = matchingDecks.slice(0, visibleDecks);
  const mixedAllSources = mixedSources.length > 0 ? mixedSources : (videos ?? []);
  const mixedPreviewVideos = mixedAllSources.slice(0, 2);
  const additionalMixedVideoCount = Math.max(0, mixedAllSources.length - mixedPreviewVideos.length);

  // ============================================================================
  // Deck picker
  // ============================================================================
  const header = (back: () => void, label: string) => (
    <div className="-ml-2 flex items-center gap-2">
      <NavigationIconButton direction="back" label={label} onClick={back} />
      <h1 className="font-heading text-section font-medium text-primary">AI chat</h1>
    </div>
  );

  if (isRestoringSession) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-body text-secondary">
          <LoadingAnimation className="h-6 w-6" />
          <span>Restoring your conversation…</span>
        </div>
      </div>
    );
  }

  if (phase === 'deck') {
    return (
      <div className="theme-chat mx-auto min-h-screen max-w-page bg-app px-5 pb-20 pt-8 sm:px-8">
        {header(() => onNavigate?.('practice'), 'Back')}

        {chatError && <div className="mt-6 text-body-sm font-medium text-accent">{chatError}</div>}

        {videos === null ? (
          <div className="mt-8" role="status" aria-live="polite">
            <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
            </div>
            <Skeleton className="mt-12 h-80 w-full rounded-2xl" />
          </div>
        ) : videos.length === 0 ? (
          <PracticeEmptyState mode="AI chat" />
        ) : (
          <>
            <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Conversation actions">
              {recentSession && (
                <section aria-labelledby="resume-title" className="flex min-h-24 items-center justify-between gap-x-6 rounded-2xl bg-sage-soft px-7 py-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {recentSession.seed_video_id && !recentSession.seed_video_id.startsWith('netflix_') && (
                      <img
                        src={`https://img.youtube.com/vi/${recentSession.seed_video_id}/mqdefault.jpg`}
                        alt=""
                        loading="lazy"
                        className="hidden h-14 w-24 shrink-0 rounded-lg object-cover sm:block"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="min-w-0">
                      <h2 id="resume-title" className="truncate font-heading text-lead text-sage-deep">Continue your conversation</h2>
                      <p className="mt-0.5 truncate text-body-sm text-sage-ink">
                        {recentSession.seed_label || 'Previous conversation'} · {recentSession.turn_count} {recentSession.turn_count === 1 ? 'message' : 'messages'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resumeLastSession}
                    disabled={resuming}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover disabled:opacity-60"
                  >
                    {resuming ? <LoadingAnimation className="h-4 w-4" /> : <Play className="size-4" aria-hidden="true" />}
                    Continue
                  </button>
                </section>
              )}

              <section aria-labelledby="mixed-title" className={`flex min-h-24 flex-wrap items-center justify-between gap-x-6 gap-y-5 rounded-2xl bg-surface px-7 py-5 lg:flex-nowrap ${recentSession ? '' : 'sm:col-span-2'}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {mixedPreviewVideos.length > 0 && (
                    <ul className="flex shrink-0 items-center -space-x-3" aria-label={mixedSources.length > 0 ? `Words will be drawn from ${mixedPreviewVideos.map((video) => video.title).join(', ')}` : 'Videos available for your mixed chat'}>
                      {mixedPreviewVideos.map((video) => {
                        const isNetflix = video.video_id.startsWith('netflix_');
                        return (
                          <li key={video.video_id} title={video.title}>
                            {isNetflix ? (
                              <span className="flex h-14 w-24 items-center justify-center rounded-lg border-2 border-surface bg-[#B20710]/10 text-meta font-bold text-[#B20710]">N</span>
                            ) : (
                              <img
                                src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                                alt={video.title}
                                className="h-14 w-24 rounded-lg border-2 border-surface object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                          </li>
                        );
                      })}
                      {additionalMixedVideoCount > 0 && (
                        <li className="flex h-14 w-14 items-center justify-center rounded-lg border-2 border-surface bg-sand-mid text-meta font-semibold text-sand-deep">
                          +{additionalMixedVideoCount}
                        </li>
                      )}
                    </ul>
                  )}
                  <div className="min-w-0">
                    <h2 id="mixed-title" className="truncate font-heading text-lead text-primary">Start a mixed chat</h2>
                    <p className="truncate text-body-sm text-secondary">
                      {mixedSources.length > 0
                        ? `Words from ${mixedSources.length} ${mixedSources.length === 1 ? 'video' : 'videos'}`
                        : 'Words from your tracked videos'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startMixedSession}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-app px-5 py-2.5 text-body-sm font-semibold text-primary transition-colors duration-150 ease-swift hover:bg-surface-hover"
                >
                  <Shuffle className="size-4 text-accent" aria-hidden="true" />
                  Start chat
                </button>
              </section>
            </section>

            <section aria-labelledby="sources-title" className="mt-14">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-subtle pb-4">
                <h2 id="sources-title" className="font-heading text-card-title text-primary">Your videos</h2>
                <div className="flex flex-1 items-center justify-end gap-3">
                  <label className="relative w-full max-w-xs">
                    <span className="sr-only">Search videos</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input
                      type="search"
                      value={deckQuery}
                      onChange={(e) => {
                        setDeckQuery(e.target.value);
                        setVisibleDecks(DECK_PAGE_SIZE);
                      }}
                      placeholder="Search a video"
                      className="w-full rounded-xl border border-subtle bg-surface py-2.5 pl-9 pr-3 text-body-sm text-primary placeholder:text-muted focus:border-accent focus:outline-none"
                    />
                  </label>
                  <div className="relative shrink-0" ref={deckSortRef}>
                    <button
                      type="button"
                      onClick={() => setIsDeckSortOpen((open) => !open)}
                      aria-expanded={isDeckSortOpen}
                      aria-controls="chat-video-sort-options"
                      className="flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:bg-surface-hover hover:text-primary"
                    >
                      {currentDeckSort.label}
                      <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isDeckSortOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                      <span className="sr-only">Sort videos</span>
                    </button>
                    <AnimatePresence>
                      {isDeckSortOpen && (
                        <motion.ul
                          id="chat-video-sort-options"
                          aria-label="Sort videos"
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                          className="absolute right-0 top-full z-20 mt-2 w-48 origin-top-right space-y-1 rounded-xl border border-subtle bg-app p-2 shadow-lg"
                        >
                          {deckSorts.map((option) => {
                            const isSelected = option.value === deckSort;
                            return (
                              <li key={option.value}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeckSort(option.value);
                                    setVisibleDecks(DECK_PAGE_SIZE);
                                    setIsDeckSortOpen(false);
                                  }}
                                  aria-pressed={isSelected}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-body-sm transition-colors duration-150 ease-swift ${isSelected ? 'selected-surface font-medium text-accent' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                                >
                                  <span className="flex-1 text-left">{option.label}</span>
                                  {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                                </button>
                              </li>
                            );
                          })}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {matchingDecks.length === 0 ? (
                <p className="py-16 text-center text-body text-muted">Nothing matches "{deckQuery}".</p>
              ) : (
                <ul>
                  {shownDecks.map((video) => {
                    const isNetflix = video.video_id.startsWith('netflix_');
                    const words = deckWords[video.video_id];
                    const due = deckDueCounts[video.video_id] ?? 0;
                    const videoUrl = isNetflix
                      ? `https://www.netflix.com/watch/${video.video_id.replace('netflix_', '')}`
                      : `https://www.youtube.com/watch?v=${video.video_id}`;
                    return (
                      <li key={video.video_id} className="flex items-center gap-5 border-b border-subtle py-4">
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open on ${isNetflix ? 'Netflix' : 'YouTube'}`}
                          className="group/thumb relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-hover"
                        >
                          {isNetflix ? (
                            <div className="flex h-full w-full items-center justify-center bg-[#B20710]/10"><Film className="h-5 w-5 text-[#B20710]" aria-hidden="true" /></div>
                          ) : (
                            <img src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-150 ease-swift group-hover/thumb:bg-black/40 group-hover/thumb:opacity-100"><ExternalLink className="h-4 w-4 text-[#ffffff]" aria-hidden="true" /></div>
                        </a>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold text-primary">{video.title}</p>
                          <p className="mt-0.5 break-words text-body-sm text-muted">
                            {isNetflix ? 'Netflix' : 'YouTube'} · {relativeDay(video.tracked_at)}{words !== undefined && ` · ${words.length} words`}
                          </p>
                        </div>
                        <p className={`hidden w-20 shrink-0 text-right text-body-sm font-semibold sm:block ${due > 0 ? 'text-accent' : 'text-muted'}`}>
                          {words === undefined ? 'Counting…' : due > 0 ? `${due} due` : 'Ready'}
                        </p>
                        <button
                          type="button"
                          onClick={() => startFromVideo(video)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-surface-hover px-3.5 py-2 text-body-sm font-semibold text-primary transition-colors duration-150 ease-swift hover:bg-blush"
                        >
                          <Play className="h-3.5 w-3.5" aria-hidden="true" />
                          Start chat
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {visibleDecks < matchingDecks.length && (
                <button
                  type="button"
                  onClick={() => setVisibleDecks((count) => count + DECK_PAGE_SIZE)}
                  className="mt-6 w-full rounded-xl py-2.5 text-body-sm font-semibold text-muted transition-colors duration-150 ease-swift hover:text-primary"
                >
                  Show {Math.min(DECK_PAGE_SIZE, matchingDecks.length - visibleDecks)} more of {matchingDecks.length}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  // ============================================================================
  // Chat — voice-first "call" view by default, with a Transcript toggle for
  // history and a Coach drawer for target words / corrections / saved words.
  // ============================================================================
  return (
    <div className="theme-chat -mt-2 flex h-[calc(100vh-2rem)] w-full flex-col bg-app md:h-[calc(100vh-4rem)]">
      <SessionHeader
        title={deck?.title || 'Voice Chat'}
        subtitle={profile ? `${langName} · ${profile.level}` : langName}
        thumbnailVideoId={deck?.id ?? null}
        stackedVideos={mixedThumbs}
        targets={targetWords}
        usedCount={usedCount}
        coachOpen={coachOpen}
        onToggleCoach={() => setCoachOpen((v) => !v)}
        transcriptOpen={transcriptOpen}
        onToggleTranscript={() => setTranscriptOpen((v) => !v)}
        onLeave={leaveChat}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <main className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {transcriptOpen ? (
              <motion.div
                key="transcript"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                <div className="mx-auto w-full max-w-reading px-4 py-8 sm:px-6">
                  <h2 className="mb-6 font-heading text-body font-semibold text-primary">Transcript</h2>
                  <MessageList
                    messages={messages}
                    language={language}
                    tutorInitial={tutorInitial}
                    targetWords={targetWords}
                    thinking={tutorBusy}
                    regenerating={regenLoading}
                    savedWords={savedWords}
                    onSaveWord={(w) => saveWord(w.lemma, w.gloss)}
                    onRegenerate={handleAnotherResponse}
                    onSuggest={handleSuggestReply}
                    onListen={speak}
                    romanized={msgRoman}
                    revealedCorrections={revealedCorrections}
                    onRevealCorrection={(id) => setRevealedCorrections((prev) => new Set(prev).add(id))}
                    correctionVerdicts={correctionVerdicts}
                    onCorrectionFeedback={handleCorrectionFb}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="live"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-6"
              >
                <VoiceStage
                  language={language}
                  tutorInitial={tutorInitial}
                  tutorTurn={tutorTurn}
                  lastUserTurn={lastUserTurn}
                  orbState={orbState}
                  heard={heard}
                  savedWords={savedWords}
                  onSaveWord={(w) => saveWord(w.lemma, w.gloss)}
                  onRegenerate={handleAnotherResponse}
                  onSuggest={handleSuggestReply}
                  onListen={speak}
                  regenerating={regenLoading}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="shrink-0 bg-app">
            <div className="mx-auto w-full max-w-reading space-y-3 px-4 pb-8 pt-2 sm:px-6">
              <SuggestionPanel
                suggestions={activeSuggestions}
                onPick={(reply) => { setSuggestVisibleId(null); sendTextTurn(reply.es); }}
                onEdit={(reply) => { setComposerText(reply.es); setSuggestVisibleId(null); setTyping(true); }}
                onDismiss={() => setSuggestVisibleId(null)}
              />

              {typing ? (
                <Composer
                  value={composerText}
                  onChange={setComposerText}
                  onSend={(text) => sendTextTurn(text)}
                  thinking={sending}
                  placeholder={openingPending ? 'Tutor is writing…' : `Type in ${langName}…`}
                  onClose={() => setTyping(false)}
                />
              ) : (
                <VoiceControls
                  live={voiceStatus !== 'off'}
                  capturing={voiceStatus === 'listening'}
                  connecting={voiceStatus === 'connecting'}
                  status={status}
                  onStart={startVoice}
                  onStop={stopVoice}
                  onType={() => { if (voiceStatus !== 'off') stopVoice(); setTyping(true); }}
                />
              )}

              {(voiceError || chatError) && (
                <p className="text-center text-meta text-accent" role="status" aria-live="polite">
                  {voiceError || chatError}
                </p>
              )}
            </div>
          </div>
        </main>

        <AnimatePresence>
          {coachOpen && (
            <CoachDrawer
              deck={deck}
              targets={targetWords}
              usedLemmas={usedLemmas}
              openWord={openTargetWord}
              onToggleWord={(lemma) => setOpenTargetWord((cur) => (cur === lemma ? null : lemma))}
              messages={messages}
              savedWords={savedWords}
              latestCoaching={latestCoaching}
              advancedOpen={advancedOpen}
              onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
              onClose={() => setCoachOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
