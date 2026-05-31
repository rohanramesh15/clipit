import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Keyboard,
  Send,
  X,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  HelpCircle,
  Settings,
  Loader2,
  Layers,
  Compass,
  MessageCircle,
} from 'lucide-react';
import {
  getProfile,
  saveOnboarding,
  createSession,
  sendTurn,
  getHint,
  howDoISay,
  translate,
  correctionFeedback,
  voiceWsUrl,
  type Profile,
  type Level,
  type Reason,
  type EnglishSupport,
  type DueWord,
  type Correction,
  type SuggestedReply,
} from '../services/converseV2';
import { VoiceSession, VoiceEvent } from '../lib/voiceSession';
import { useAuth } from '../context/AuthContext';
import './converseV2.css';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type Stage = 'loading' | 'onboarding' | 'start' | 'topic' | 'chat';
type Seed = 'due' | 'topic' | 'free';
type VoiceStatus = 'off' | 'connecting' | 'listening' | 'speaking';

interface TopicDef {
  id: string;
  emoji: string;
  label: string;
  blurb: string;
  custom?: boolean;
  why: { q: string; options?: string[]; placeholder?: string };
  detail: { q: string; placeholder: string };
}

interface TopicContext {
  topic: TopicDef;
  why: string;
  detail: string;
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

const SEED_TYPE: Record<Seed, 'due_words' | 'topic' | 'free'> = {
  due: 'due_words',
  topic: 'topic',
  free: 'free',
};

const SEED_COLORS: Record<Seed, string> = {
  due: '#a8694f',
  topic: '#4c817b',
  free: '#7a6593',
};

// --------------------------------------------------------------------------
// Onboarding steps (mirrors the design; values mapped to the backend contract)
// --------------------------------------------------------------------------

interface OnbOption {
  val: string;
  emoji: string;
  main: string;
  meta?: string;
}
interface OnbStep {
  key: 'level' | 'reason' | 'support';
  kicker: string;
  q: string;
  sub: string;
  options: OnbOption[];
  allowOther?: boolean;
}

const ONB_STEPS: OnbStep[] = [
  {
    key: 'level',
    kicker: 'Step 1 of 3',
    q: 'How much Spanish do you have?',
    sub: 'This sets how complex the conversation gets, and how fast.',
    options: [
      { val: 'beginner', emoji: '🌱', main: 'Just starting', meta: 'A1 · beginner' },
      { val: 'intermediate', emoji: '🌿', main: 'Getting there', meta: 'A2–B1 · intermediate' },
      { val: 'advanced', emoji: '🌳', main: 'Pretty comfortable', meta: 'B1–B2 · advanced' },
    ],
  },
  {
    key: 'reason',
    kicker: 'Step 2 of 3',
    q: 'What are you learning for?',
    sub: "We'll lean the topics and vocabulary your way.",
    options: [
      { val: 'travel', emoji: '✈️', main: 'Travel' },
      { val: 'work', emoji: '💼', main: 'Work' },
      { val: 'family', emoji: '🏡', main: 'Family' },
      { val: 'partner', emoji: '💛', main: 'A partner' },
      { val: 'show', emoji: '🎬', main: 'Shows & music' },
      { val: 'general', emoji: '🧭', main: 'Just generally' },
      { val: 'other', emoji: '✍️', main: 'Something else' },
    ],
    allowOther: true,
  },
  {
    key: 'support',
    kicker: 'Step 3 of 3',
    q: 'How much English should we use?',
    sub: "When you're stuck, how much should we lean on English to help?",
    options: [
      { val: 'lots', emoji: '🪢', main: 'Lots, please', meta: 'Translate freely, explain in English' },
      { val: 'some', emoji: '⚖️', main: 'Some', meta: 'English when I really need it' },
      { val: 'minimal', emoji: '🌊', main: 'Keep it minimal', meta: 'Stay in Spanish, push me' },
    ],
  },
];

// --------------------------------------------------------------------------
// Topic areas (ported from the design's data.js)
// --------------------------------------------------------------------------

const TOPICS: TopicDef[] = [
  {
    id: 'travel', emoji: '✈️', label: 'Travel', blurb: 'Trips, directions, getting around',
    why: { q: "What's prompting this?", options: ['Planning a trip', 'Booking something now', 'Just got back', 'Practicing for someday'] },
    detail: { q: 'Anywhere specific in mind?', placeholder: 'e.g. Madrid, a beach town, anywhere' },
  },
  {
    id: 'food', emoji: '🍽️', label: 'Food & dining', blurb: 'Ordering, cooking, favorites',
    why: { q: "What's the setting?", options: ['Ordering at a restaurant', 'At a market', 'Cooking at home', 'Talking favorites'] },
    detail: { q: 'Any dish or cuisine on your mind?', placeholder: 'e.g. tapas, paella, breakfast' },
  },
  {
    id: 'work', emoji: '💼', label: 'Work', blurb: 'Meetings, your job, intros',
    why: { q: "What's the context?", options: ['Introducing myself', 'Talking about my job', 'A meeting', 'A job interview'] },
    detail: { q: 'What field are you in?', placeholder: 'e.g. design, healthcare, sales' },
  },
  {
    id: 'people', emoji: '🏡', label: 'Family & friends', blurb: 'Relationships, plans, catching up',
    why: { q: "Who's on your mind?", options: ['My family', 'A partner', 'Friends', 'Meeting new people'] },
    detail: { q: "What's the occasion?", placeholder: 'e.g. a visit, a birthday, just catching up' },
  },
  {
    id: 'hobbies', emoji: '🎨', label: 'Hobbies', blurb: 'Sports, music, shows, games',
    why: { q: 'What kind?', options: ['Sports', 'Music', 'Movies & shows', 'Reading', 'Games'] },
    detail: { q: 'Which one, specifically?', placeholder: 'e.g. fútbol, jazz, a series you love' },
  },
  {
    id: 'other', emoji: '✨', label: 'Something else', blurb: 'Pick your own subject', custom: true,
    why: { q: 'What do you want to talk about?', placeholder: 'e.g. el cine, mi mascota, las noticias' },
    detail: { q: 'Anything specific to set the scene?', placeholder: 'optional' },
  },
];

const REASON_OPTS: { val: string; label: string }[] = [
  { val: 'travel', label: 'Travel' },
  { val: 'work', label: 'Work' },
  { val: 'family', label: 'Family' },
  { val: 'partner', label: 'A partner' },
  { val: 'show', label: 'Shows & music' },
  { val: 'general', label: 'Just generally' },
];

// --------------------------------------------------------------------------
// Tappable Spanish text — tap any word for its meaning (popover above word)
// --------------------------------------------------------------------------

function stripPunct(word: string): string {
  return word.replace(/^[¿?¡!.,;:"'()«»…]+|[¿?¡!.,;:"'()«»…]+$/gu, '');
}

function TappableText({
  text,
  targets = [],
  onWordTap,
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
            className={'tw' + (isTarget ? ' target' : '')}
            onClick={(e) => onWordTap(clean, e)}
          >
            {tk}
          </span>
        );
      })}
    </span>
  );
}

// --------------------------------------------------------------------------
// Voice CTA — circular primary action button with the design's halo states.
// --------------------------------------------------------------------------

function VoiceCTA({ status, onToggle }: { status: VoiceStatus; onToggle: () => void }) {
  const active = status !== 'off';
  const cls =
    'voice-cta' +
    (status === 'listening' ? ' live listening' : status === 'speaking' ? ' aispeaking' : '');
  return (
    <button
      type="button"
      className={cls}
      onClick={onToggle}
      disabled={status === 'connecting'}
      title={active ? 'End call' : 'Start voice call'}
      aria-label={active ? 'End call' : 'Start voice call'}
    >
      <span className="halo" />
      {status === 'connecting' ? (
        <Loader2 className="cv2-spin" size={28} />
      ) : active ? (
        <MicOff size={28} />
      ) : (
        <Mic size={28} />
      )}
    </button>
  );
}

// --------------------------------------------------------------------------
// Main page
// --------------------------------------------------------------------------

export function ConverseV2Page() {
  const { user } = useAuth();
  const firstName = (user?.full_name?.trim().split(/\s+/)[0]) || (user?.email?.split('@')[0]) || '';
  const [stage, setStage] = useState<Stage>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);

  // chat session
  const [seed, setSeed] = useState<Seed>('due');
  const [topicCtx, setTopicCtx] = useState<TopicContext | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [usedLemmas, setUsedLemmas] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [starting, setStarting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // text composer / scaffolding
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [shownTranslations, setShownTranslations] = useState<Set<string>>(new Set());
  const [revealedCorrections, setRevealedCorrections] = useState<Set<string>>(new Set());
  const [correctionVerdicts, setCorrectionVerdicts] = useState<Record<string, 'fine' | 'wrong'>>({});

  // ladder + pace
  const [nudge, setNudge] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [howtoOpen, setHowtoOpen] = useState(false);
  const [howtoInput, setHowtoInput] = useState('');
  const [howtoLoading, setHowtoLoading] = useState(false);
  const [howtoResult, setHowtoResult] = useState<{ spanish: string; note_en: string } | null>(null);
  const [status, setStatus] = useState('');

  // word popover
  const [pop, setPop] = useState<{ word: string; text: string; loading: boolean; x: number; y: number } | null>(null);

  // chat settings popover (voice speed / word difficulty / accent)
  const [chatSetOpen, setChatSetOpen] = useState(false);
  const [chatPrefs, setChatPrefs] = useState(() => {
    try {
      const s = localStorage.getItem('cv2_chat_prefs');
      return s ? JSON.parse(s) : { speed: 'Normal', difficulty: 'Normal', accent: 'es-ES' };
    } catch {
      return { speed: 'Normal', difficulty: 'Normal', accent: 'es-ES' };
    }
  });

  // voice
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('off');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceRef = useRef<VoiceSession | null>(null);
  const vUserId = useRef<string | null>(null);
  const vAsstId = useRef<string | null>(null);
  const voiceAutoStarted = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ---- load profile on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { profile: p } = await getProfile();
        if (!alive) return;
        setProfile(p);
        setStage(p ? 'start' : 'onboarding');
      } catch {
        if (alive) setStage('onboarding');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- auto-scroll transcript
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, composerOpen, nudge, howtoOpen, sending]);

  // ---- close popover on scroll / outside click / escape
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

  // ---- persist chat prefs
  useEffect(() => {
    try {
      localStorage.setItem('cv2_chat_prefs', JSON.stringify(chatPrefs));
    } catch {
      /* ignore */
    }
  }, [chatPrefs]);

  // ------------------------------------------------------------------------
  // Voice wiring (real mic -> Gemini Live, restyled into the design's dock)
  // ------------------------------------------------------------------------

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

  const handleVoiceEvent = useCallback(
    (e: VoiceEvent) => {
      switch (e.type) {
        case 'connecting':
          setVoiceStatus('connecting');
          setStatus('Connecting your mic…');
          return;
        case 'ready':
          setVoiceStatus('listening');
          setStatus('Listening… just talk');
          return;
        case 'speaking_changed':
          setVoiceStatus(e.speaking ? 'speaking' : 'listening');
          setStatus(e.speaking ? 'Tutor is speaking…' : 'Your turn. Just talk');
          return;
        case 'user_transcript':
          return appendVoiceChunk('user', e.text);
        case 'assistant_transcript':
          return appendVoiceChunk('assistant', e.text);
        case 'interrupted':
          if (vAsstId.current) {
            const id = vAsstId.current;
            setMessages((prev) => prev.filter((m) => m.id !== id));
            vAsstId.current = null;
          }
          return;
        case 'turn_complete':
          vUserId.current = null;
          vAsstId.current = null;
          return;
        case 'error':
          setVoiceError(e.message);
          setVoiceStatus('off');
          setStatus('');
          return;
        case 'closed':
          vUserId.current = null;
          vAsstId.current = null;
          setVoiceStatus('off');
          return;
      }
    },
    [appendVoiceChunk],
  );

  const startVoice = useCallback(async () => {
    if (!sessionId || voiceStatus !== 'off') return;
    setVoiceError(null);
    const vs = new VoiceSession();
    vs.on(handleVoiceEvent);
    voiceRef.current = vs;
    try {
      await vs.start(voiceWsUrl(sessionId));
    } catch (e: any) {
      setVoiceError(e?.message || 'Could not start voice');
      setVoiceStatus('off');
    }
  }, [sessionId, voiceStatus, handleVoiceEvent]);

  const stopVoice = useCallback(() => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    vUserId.current = null;
    vAsstId.current = null;
    setVoiceStatus('off');
    setStatus('Tap the mic to talk, or the keyboard to type');
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceStatus === 'off') startVoice();
    else stopVoice();
  }, [voiceStatus, startVoice, stopVoice]);

  // tear down voice on unmount
  useEffect(() => {
    return () => {
      voiceRef.current?.stop();
      voiceRef.current = null;
    };
  }, []);

  // voice-first: auto-start the call once per session on entering chat
  useEffect(() => {
    if (stage !== 'chat' || !sessionId || voiceAutoStarted.current) return;
    voiceAutoStarted.current = true;
    startVoice();
  }, [stage, sessionId, startVoice]);

  // ------------------------------------------------------------------------
  // Onboarding
  // ------------------------------------------------------------------------

  const finishOnboarding = useCallback(async (answers: Record<string, string>) => {
    const req: Profile = {
      level: (answers.level || 'intermediate') as Level,
      reason: (answers.reason || 'general') as Reason,
      english_support: (answers.support || 'some') as EnglishSupport,
    };
    try {
      const { profile: p } = await saveOnboarding(req);
      setProfile(p);
    } catch {
      setProfile(req); // optimistic
    }
    setStage('start');
  }, []);

  const changeProfile = useCallback(async (p: Profile) => {
    setProfile(p);
    try {
      await saveOnboarding(p);
    } catch {
      /* keep optimistic */
    }
  }, []);

  // ------------------------------------------------------------------------
  // Session lifecycle
  // ------------------------------------------------------------------------

  const beginSession = useCallback(
    async (s: Seed, opts?: { seedLabel?: string; context?: TopicContext }) => {
      if (starting) return;
      setStarting(true);
      setChatError(null);
      try {
        const result = await createSession({
          seed_type: SEED_TYPE[s],
          seed_label: opts?.seedLabel,
        });
        setSeed(s);
        setTopicCtx(opts?.context || null);
        setSessionId(result.session_id);
        setDueWords(result.due_words || []);
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
        setStatus('Connecting your mic…');
        setMessages([
          {
            id: `a-${result.opening.turn_id}`,
            role: 'assistant',
            text: result.opening.reply,
            translation: result.opening.reply_translation,
            turnId: result.opening.turn_id,
          },
        ]);
        setStage('chat');
      } catch {
        setChatError('Could not start a session. Please try again.');
      } finally {
        setStarting(false);
      }
    },
    [starting],
  );

  const backToStart = useCallback(() => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    vUserId.current = null;
    vAsstId.current = null;
    voiceAutoStarted.current = false;
    setVoiceStatus('off');
    setVoiceError(null);
    setSessionId(null);
    setMessages([]);
    setDueWords([]);
    setUsedLemmas(new Set());
    setComposerOpen(false);
    setComposerText('');
    setNudge(null);
    setHowtoOpen(false);
    setHowtoResult(null);
    setStage('start');
  }, []);

  // ------------------------------------------------------------------------
  // Chat actions
  // ------------------------------------------------------------------------

  const sendTextTurn = useCallback(
    async (override?: string) => {
      const text = (override ?? composerText).trim();
      if (!text || sending || sessionId == null) return;
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
      setMessages((prev) => [...prev, userMsg]);
      setComposerText('');
      setNudge(null);
      setSending(true);
      setStatus('Tutor is writing…');
      try {
        const result = await sendTurn(sessionId, text);
        const used = result.used_target_words || [];
        if (used.length) {
          setUsedLemmas((prev) => {
            const next = new Set(prev);
            used.forEach((w) => next.add(w));
            return next;
          });
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${result.turn_id}`,
            role: 'assistant',
            text: result.reply,
            translation: result.reply_translation,
            correction: result.correction,
            turnId: result.turn_id,
            suggestedReplies: result.suggested_replies,
            targets: used,
          },
        ]);
        setStatus('Tap a word for its meaning · pick a suggested reply below');
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        setComposerText(text);
        setChatError('Message failed to send. Try again.');
      } finally {
        setSending(false);
      }
    },
    [composerText, sending, sessionId],
  );

  const handleWordTap = useCallback(async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.target as HTMLElement).getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top;
    setPop({ word, text: '', loading: true, x, y });
    try {
      const t = await translate(word);
      setPop((cur) => (cur && cur.word === word ? { ...cur, text: t, loading: false } : cur));
    } catch {
      setPop((cur) => (cur && cur.word === word ? { ...cur, text: '—', loading: false } : cur));
    }
  }, []);

  const handleHint = useCallback(async () => {
    if (sessionId == null) {
      setNudge("Try saying where you'd like to go, or what you'd do there. You don't need the perfect words.");
      return;
    }
    setHintLoading(true);
    try {
      const { hint_en } = await getHint(sessionId);
      setNudge(hint_en);
    } catch {
      setNudge('Try answering with one short sentence — even a few words helps.');
    } finally {
      setHintLoading(false);
    }
  }, [sessionId]);

  const runHowto = useCallback(async () => {
    if (sessionId == null) return;
    const english = howtoInput.trim();
    if (!english) return;
    setHowtoLoading(true);
    setHowtoResult(null);
    try {
      const result = await howDoISay(sessionId, english);
      setHowtoResult(result);
    } catch {
      setHowtoResult({ spanish: '', note_en: "Couldn't fetch a phrasing." });
    } finally {
      setHowtoLoading(false);
    }
  }, [sessionId, howtoInput]);

  const handleCorrectionFb = useCallback(
    async (messageId: string, turnId: number | undefined, verdict: 'fine' | 'wrong') => {
      if (turnId == null || correctionVerdicts[messageId]) return;
      setCorrectionVerdicts((prev) => ({ ...prev, [messageId]: verdict }));
      try {
        await correctionFeedback(turnId, verdict);
      } catch {
        /* keep optimistic */
      }
    },
    [correctionVerdicts],
  );

  const openComposer = () => {
    setComposerOpen(true);
    setNudge(null);
    setTimeout(() => taRef.current?.focus(), 60);
  };
  const pickSuggestion = (es: string) => {
    setComposerOpen(true);
    setComposerText(es);
    setTimeout(() => taRef.current?.focus(), 60);
  };

  const translationShownByDefault = profile?.english_support === 'lots';
  const isTransVisible = (id: string) =>
    translationShownByDefault ? !shownTranslations.has(id) : shownTranslations.has(id);
  const toggleTrans = (id: string) =>
    setShownTranslations((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const lastAssistantId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  })();

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="cv2-root">
      {stage === 'loading' && (
        <div className="cv2-center">
          <Loader2 className="cv2-spin" size={30} />
        </div>
      )}

      {stage === 'onboarding' && <Onboarding onDone={finishOnboarding} />}

      {stage === 'start' && (
        <StartScreen
          profile={profile}
          greetingName={firstName}
          starting={starting}
          error={chatError}
          onDue={() => beginSession('due')}
          onTopic={() => setStage('topic')}
          onFree={() => beginSession('free')}
          onChangeProfile={changeProfile}
        />
      )}

      {stage === 'topic' && (
        <TopicFlow
          onBack={() => setStage('start')}
          onStart={(ctx, label) => beginSession('topic', { context: ctx, seedLabel: label })}
        />
      )}

      {stage === 'chat' && (
        <ChatView
          seed={seed}
          topicCtx={topicCtx}
          dueWords={dueWords}
          usedLemmas={usedLemmas}
          messages={messages}
          status={status}
          voiceStatus={voiceStatus}
          voiceError={voiceError}
          chatError={chatError}
          sending={sending}
          lastAssistantId={lastAssistantId}
          composerOpen={composerOpen}
          composerText={composerText}
          nudge={nudge}
          hintLoading={hintLoading}
          howtoOpen={howtoOpen}
          howtoInput={howtoInput}
          howtoLoading={howtoLoading}
          howtoResult={howtoResult}
          pop={pop}
          revealedCorrections={revealedCorrections}
          correctionVerdicts={correctionVerdicts}
          chatSetOpen={chatSetOpen}
          chatPrefs={chatPrefs}
          isTransVisible={isTransVisible}
          taRef={taRef}
          scrollRef={scrollRef}
          onBack={backToStart}
          onToggleVoice={toggleVoice}
          onOpenComposer={openComposer}
          onCloseComposer={() => {
            setComposerOpen(false);
            setComposerText('');
          }}
          onComposerChange={setComposerText}
          onSend={() => sendTextTurn()}
          onWordTap={handleWordTap}
          onToggleTrans={toggleTrans}
          onRevealCorrection={(id) => setRevealedCorrections((prev) => new Set(prev).add(id))}
          onCorrectionFb={handleCorrectionFb}
          onPickSuggestion={pickSuggestion}
          onHint={handleHint}
          onToggleHowto={() => setHowtoOpen((v) => !v)}
          onHowtoInput={setHowtoInput}
          onRunHowto={runHowto}
          onCloseHowto={() => {
            setHowtoOpen(false);
            setHowtoInput('');
            setHowtoResult(null);
          }}
          onDismissNudge={() => setNudge(null)}
          onToggleChatSet={() => setChatSetOpen((v) => !v)}
          onCloseChatSet={() => setChatSetOpen(false)}
          onChatPref={(k, v) => setChatPrefs((p: any) => ({ ...p, [k]: v }))}
        />
      )}
    </div>
  );
}

// ==========================================================================
// Onboarding
// ==========================================================================

function Onboarding({ onDone }: { onDone: (answers: Record<string, string>) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [otherText, setOtherText] = useState<Record<string, string>>({});
  const cur = ONB_STEPS[step];
  const picked = answers[cur.key];
  const otherActive = !!cur.allowOther && picked === 'other';
  const otherVal = (otherText[cur.key] || '').trim();
  const canContinue = !!picked && (!otherActive || otherVal.length > 0);

  const next = () => {
    const final = { ...answers };
    ONB_STEPS.forEach((s) => {
      if (s.allowOther && final[s.key] === 'other' && (otherText[s.key] || '').trim()) {
        final[s.key] = otherText[s.key].trim();
      }
    });
    if (step < ONB_STEPS.length - 1) setStep(step + 1);
    else onDone(final);
  };

  return (
    <div className="onb">
      <div className="onb-card" key={step}>
        <div className="onb-progress">
          {ONB_STEPS.map((_, i) => (
            <div key={i} className={'onb-dot' + (i === step ? ' on' : i < step ? ' done' : '')} />
          ))}
        </div>

        <div className="fade-up">
          <div className="onb-kicker">{cur.kicker}</div>
          <h1 className="onb-q" style={{ marginTop: 12 }}>{cur.q}</h1>
          <p className="onb-sub">{cur.sub}</p>
        </div>

        <div className="onb-opts">
          {cur.options.map((o, i) => (
            <button
              key={o.val}
              className={'onb-opt fade-up' + (picked === o.val ? ' sel' : '')}
              style={{ animationDelay: `${0.05 + i * 0.04}s` }}
              onClick={() => setAnswers((a) => ({ ...a, [cur.key]: o.val }))}
            >
              <span className="onb-opt-emoji">{o.emoji}</span>
              <span>
                <span className="onb-opt-main">{o.main}</span>
                {o.meta && <span className="onb-opt-meta">{o.meta}</span>}
              </span>
              <span className="onb-opt-radio" />
            </button>
          ))}
        </div>

        {otherActive && (
          <input
            className="onb-other"
            autoFocus
            placeholder="Tell me. For example, &ldquo;preparing for a move to Mexico&rdquo;"
            value={otherText[cur.key] || ''}
            onChange={(e) => setOtherText((o) => ({ ...o, [cur.key]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canContinue) next();
            }}
          />
        )}

        <div className="onb-foot">
          <button
            className="btn btn-ghost"
            onClick={() => step > 0 && setStep(step - 1)}
            title="Back"
            aria-label="Back"
            style={{ visibility: step > 0 ? 'visible' : 'hidden' }}
          >
            <ArrowLeft size={18} />
          </button>
          <button className="btn btn-primary" disabled={!canContinue} onClick={next}>
            {step === ONB_STEPS.length - 1 ? 'Start learning' : 'Continue'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Start screen
// ==========================================================================

function StartScreen({
  profile,
  greetingName,
  starting,
  error,
  onDue,
  onTopic,
  onFree,
  onChangeProfile,
}: {
  profile: Profile | null;
  greetingName: string;
  starting: boolean;
  error: string | null;
  onDue: () => void;
  onTopic: () => void;
  onFree: () => void;
  onChangeProfile: (p: Profile) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cards = [
    { key: 'due', color: SEED_COLORS.due, Icon: Layers, title: 'Practice due words', desc: "Your due words are ready. We'll weave them into the chat naturally.", action: onDue },
    { key: 'topic', color: SEED_COLORS.topic, Icon: Compass, title: 'Pick a topic', desc: "Choose an area to talk about and we'll set the scene.", action: onTopic },
    { key: 'free', color: SEED_COLORS.free, Icon: MessageCircle, title: 'Just chat', desc: "No agenda. Open with anything and we'll take it from there.", action: onFree },
  ];

  return (
    <div className="start">
      <div className="start-stage">
        <div className="start-hero fade-up">
          <h1 className="start-hi">¡Hola{greetingName ? `, ${greetingName}` : ''}! Ready to talk?</h1>
          <p className="start-sub">Practice real Spanish by voice or text, with help whenever you get stuck.</p>
        </div>

        {error && <p className="cv2-error">{error}</p>}

        <div className="cards">
          {cards.map((c, i) => (
            <button
              key={c.key}
              className="card fade-up"
              style={{ animationDelay: `${0.08 + i * 0.07}s`, backgroundColor: c.color }}
              onClick={c.action}
              disabled={starting}
            >
              <div className="card-top">
                <div className="card-glyph">
                  <c.Icon size={30} color="#fff" strokeWidth={1.8} />
                </div>
              </div>
              <div className="card-title">{c.title}</div>
              <div className="card-desc">{c.desc}</div>
            </button>
          ))}
        </div>

        {starting && (
          <div className="dock-status">
            <Loader2 className="cv2-spin" size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Starting…
          </div>
        )}
      </div>

      <div className="settings-anchor settings-corner">
        <button className="icon-btn settings-btn" onClick={() => setSettingsOpen((o) => !o)} title="Settings">
          <Settings size={20} />
        </button>
        {settingsOpen && profile && (
          <SettingsPopover profile={profile} onChange={onChangeProfile} onClose={() => setSettingsOpen(false)} />
        )}
      </div>
    </div>
  );
}

function SettingsPopover({
  profile,
  onChange,
  onClose,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reasonKnown = REASON_OPTS.some((o) => o.val === profile.reason);
  const [otherMode, setOtherMode] = useState(!reasonKnown && !!profile.reason);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const set = (key: keyof Profile, val: string) => onChange({ ...profile, [key]: val } as Profile);

  const fields: { key: keyof Profile; label: string; options: { val: string; label: string }[] }[] = [
    { key: 'level', label: 'Spanish level', options: [
      { val: 'beginner', label: 'Beginner' }, { val: 'intermediate', label: 'Intermediate' }, { val: 'advanced', label: 'Advanced' },
    ] },
    { key: 'english_support', label: 'English support', options: [
      { val: 'lots', label: 'Lots' }, { val: 'some', label: 'Some' }, { val: 'minimal', label: 'Minimal' },
    ] },
  ];

  return (
    <div className="settings-pop" ref={ref}>
      <div className="settings-head">
        <h4>Your preferences</h4>
        <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
      </div>

      {fields.map((f) => (
        <div className="settings-field" key={f.key}>
          <div className="settings-flabel">{f.label}</div>
          <div className="seg">
            {f.options.map((o) => (
              <button
                key={o.val}
                className={'seg-btn' + (profile[f.key] === o.val ? ' on' : '')}
                onClick={() => set(f.key, o.val)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="settings-field">
        <div className="settings-flabel">Learning for</div>
        <select
          className="settings-select"
          value={otherMode ? '__other' : profile.reason}
          onChange={(e) => {
            if (e.target.value === '__other') setOtherMode(true);
            else {
              setOtherMode(false);
              set('reason', e.target.value);
            }
          }}
        >
          {REASON_OPTS.map((o) => (
            <option key={o.val} value={o.val}>{o.label}</option>
          ))}
          <option value="__other">Other…</option>
        </select>
        {otherMode && (
          <input
            className="settings-select"
            style={{ marginTop: 8 }}
            autoFocus
            placeholder="Type your reason"
            value={reasonKnown ? '' : (profile.reason as string) || ''}
            onChange={(e) => set('reason', e.target.value)}
          />
        )}
      </div>

      <div className="settings-note">Changes apply right away.</div>
    </div>
  );
}

// ==========================================================================
// Topic flow
// ==========================================================================

function TopicFlow({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: (ctx: TopicContext, seedLabel: string) => void;
}) {
  const [topic, setTopic] = useState<TopicDef | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [detail, setDetail] = useState('');

  if (!topic) {
    return (
      <div className="topic">
        <div className="topic-inner">
          <button className="icon-btn settings-btn topic-back" onClick={onBack} title="Back" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <div className="topic-head fade-up">
            <h1 className="topic-q">What do you want to talk about?</h1>
          </div>
          <div className="topic-grid">
            {TOPICS.map((t, i) => (
              <button
                key={t.id}
                className="topic-card fade-up"
                style={{ animationDelay: `${0.05 + i * 0.04}s` }}
                onClick={() => {
                  setTopic(t);
                  setWhy(null);
                  setDetail('');
                }}
              >
                <span className="topic-emoji">{t.emoji}</span>
                <span className="topic-label">{t.label}</span>
                <span className="topic-blurb">{t.blurb}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const ready = topic.custom ? !!(why && why.trim()) : !!why;
  const start = () => {
    if (!ready) return;
    if (topic.custom) {
      const label = (why || '').trim();
      const ctx: TopicContext = { topic: { ...topic, label }, why: '', detail: detail.trim() };
      const seedLabel = [label, detail.trim()].filter(Boolean).join(' · ');
      onStart(ctx, seedLabel);
    } else {
      const ctx: TopicContext = { topic, why: why as string, detail: detail.trim() };
      const seedLabel = [topic.label, why, detail.trim()].filter(Boolean).join(' · ');
      onStart(ctx, seedLabel);
    }
  };

  return (
    <div className="topic">
      <div className="topic-inner narrow">
        <button className="icon-btn settings-btn topic-back" onClick={() => setTopic(null)} title="Back to topics" aria-label="Back to topics">
          <ArrowLeft size={20} />
        </button>

        <div className="topic-chosen fade-up">
          <span className="topic-chosen-emoji">{topic.emoji}</span>
          <div>
            <div className="topic-chosen-label">{topic.label}</div>
            <div className="topic-chosen-blurb">{topic.blurb}</div>
          </div>
        </div>

        <div className="topic-qblock fade-up" style={{ animationDelay: '.05s' }}>
          <div className="topic-qlabel">{topic.why.q}</div>
          {topic.custom ? (
            <input
              className="topic-input"
              autoFocus
              value={why || ''}
              placeholder={topic.why.placeholder}
              onChange={(e) => setWhy(e.target.value)}
            />
          ) : (
            <div className="topic-chips">
              {topic.why.options?.map((o) => (
                <button key={o} className={'topic-chip' + (why === o ? ' sel' : '')} onClick={() => setWhy(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>

        {ready && (
          <div className="topic-qblock fade-up">
            <div className="topic-qlabel">
              {topic.detail.q} <span className="topic-opt">optional</span>
            </div>
            <input
              className="topic-input"
              autoFocus={!topic.custom}
              value={detail}
              placeholder={topic.detail.placeholder}
              onChange={(e) => setDetail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') start();
              }}
            />
          </div>
        )}

        <div className="topic-foot">
          <button className="btn btn-primary" disabled={!ready} onClick={start}>
            Start talking <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================================================
// Chat view
// ==========================================================================

interface ChatViewProps {
  seed: Seed;
  topicCtx: TopicContext | null;
  dueWords: DueWord[];
  usedLemmas: Set<string>;
  messages: ChatMessage[];
  status: string;
  voiceStatus: VoiceStatus;
  voiceError: string | null;
  chatError: string | null;
  sending: boolean;
  lastAssistantId: string | null;
  composerOpen: boolean;
  composerText: string;
  nudge: string | null;
  hintLoading: boolean;
  howtoOpen: boolean;
  howtoInput: string;
  howtoLoading: boolean;
  howtoResult: { spanish: string; note_en: string } | null;
  pop: { word: string; text: string; loading: boolean; x: number; y: number } | null;
  revealedCorrections: Set<string>;
  correctionVerdicts: Record<string, 'fine' | 'wrong'>;
  chatSetOpen: boolean;
  chatPrefs: { speed: string; difficulty: string; accent: string };
  isTransVisible: (id: string) => boolean;
  taRef: React.RefObject<HTMLTextAreaElement>;
  scrollRef: React.RefObject<HTMLDivElement>;
  onBack: () => void;
  onToggleVoice: () => void;
  onOpenComposer: () => void;
  onCloseComposer: () => void;
  onComposerChange: (v: string) => void;
  onSend: () => void;
  onWordTap: (word: string, e: React.MouseEvent) => void;
  onToggleTrans: (id: string) => void;
  onRevealCorrection: (id: string) => void;
  onCorrectionFb: (id: string, turnId: number | undefined, verdict: 'fine' | 'wrong') => void;
  onPickSuggestion: (es: string) => void;
  onHint: () => void;
  onToggleHowto: () => void;
  onHowtoInput: (v: string) => void;
  onRunHowto: () => void;
  onCloseHowto: () => void;
  onDismissNudge: () => void;
  onToggleChatSet: () => void;
  onCloseChatSet: () => void;
  onChatPref: (k: string, v: string) => void;
}

const ACCENT_OPTS: [string, string][] = [
  ['es-ES', 'Spain (Castilian)'],
  ['es-MX', 'Mexico'],
  ['es-AR', 'Argentina'],
  ['es-CO', 'Colombia'],
  ['es-419', 'Neutral Latin American'],
];

function ChatView(p: ChatViewProps) {
  const optColor = SEED_COLORS[p.seed];
  const seedLabel =
    p.seed === 'topic' && p.topicCtx ? p.topicCtx.topic.label : p.seed === 'due' ? 'Practice due words' : 'Just chat';

  return (
    <div className="chat">
      {/* header */}
      <div className="chat-head">
        <button className="icon-btn settings-btn" onClick={p.onBack} title="Back" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div className="head-right">
          {p.seed === 'due' && p.dueWords.length > 0 && (
            <div className="duerow">
              <span className="duerow-label">due words</span>
              {p.dueWords.map((w) => (
                <span key={w.lemma} className={'duepill' + (p.usedLemmas.has(w.lemma) ? ' used' : '')} title={w.gloss}>
                  {w.lemma}
                </span>
              ))}
            </div>
          )}
          <div className="opt-chip" style={{ color: optColor }}>
            {p.seed === 'topic' && p.topicCtx ? (
              <span className="opt-chip-emoji">{p.topicCtx.topic.emoji}</span>
            ) : (
              <span className="opt-chip-dot" style={{ background: optColor }} />
            )}
            <div className="opt-chip-text">
              <div className="opt-chip-label">{seedLabel}</div>
              {p.seed === 'topic' && p.topicCtx && (p.topicCtx.why || p.topicCtx.detail) && (
                <div className="opt-chip-sub">
                  {p.topicCtx.why}
                  {p.topicCtx.detail ? ` · ${p.topicCtx.detail}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* transcript */}
      <div className="transcript-wrap" ref={p.scrollRef}>
        <div className="transcript">
          {p.messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div key={m.id} className="turn you">
                  <div className="turn-text">
                    <TappableText text={m.text} onWordTap={p.onWordTap} />
                  </div>
                </div>
              );
            }
            const transVisible = isTransVisibleSafe(p, m);
            const revealed = p.revealedCorrections.has(m.id);
            const verdict = p.correctionVerdicts[m.id];
            const isLast = m.id === p.lastAssistantId;
            return (
              <div key={m.id} className="turn ai">
                <div className="turn-text">
                  <TappableText text={m.text} targets={m.targets} onWordTap={p.onWordTap} />
                </div>

                <div className="scaffold">
                  {m.translation && (
                    <div className="scaffold-row">
                      <button className={'minilink' + (transVisible ? ' on' : '')} onClick={() => p.onToggleTrans(m.id)}>
                        {transVisible ? 'Hide English' : 'Show in English'}
                      </button>
                    </div>
                  )}
                  {m.translation && transVisible && <div className="translation">{m.translation}</div>}

                  {m.correction &&
                    (!revealed ? (
                      <div className="scaffold-row">
                        <button className="minilink" onClick={() => p.onRevealCorrection(m.id)}>
                          <Lightbulb size={14} /> A better way to say that
                        </button>
                      </div>
                    ) : (
                      <div className="correction">
                        <div className="correction-h">A better way to say that</div>
                        <div className="correction-fix">{m.correction.correct}</div>
                        <div className="correction-why">{m.correction.why_en}</div>
                        <div className="correction-fb">
                          <button
                            className={'fb-btn' + (verdict === 'fine' ? ' picked' : '')}
                            disabled={!!verdict}
                            onClick={() => p.onCorrectionFb(m.id, m.turnId, 'fine')}
                          >
                            That was fine
                          </button>
                          <button
                            className={'fb-btn' + (verdict === 'wrong' ? ' picked' : '')}
                            disabled={!!verdict}
                            onClick={() => p.onCorrectionFb(m.id, m.turnId, 'wrong')}
                          >
                            Not right
                          </button>
                          {verdict && <span className="fb-thanks">thanks</span>}
                        </div>
                      </div>
                    ))}

                  {isLast && m.suggestedReplies && m.suggestedReplies.length > 0 && (
                    <div className="suggests">
                      <div className="suggests-h">Suggested replies</div>
                      {m.suggestedReplies.slice(0, 3).map((s, i) => (
                        <button key={i} className="suggest" onClick={() => p.onPickSuggestion(s.es)}>
                          <div className="s-es">{s.es}</div>
                          {s.en && <div className="s-en">{s.en}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {p.sending && <div className="dock-status">Lía is writing…</div>}
        </div>
      </div>

      {/* dock */}
      <div className="dock">
        <div className="dock-float">
          {p.nudge && (
            <div className="nudge">
              <span className="nudge-icon"><Lightbulb size={18} /></span>
              <span className="nudge-text">{p.nudge}</span>
              <button className="nudge-x" onClick={p.onDismissNudge}><X size={16} /></button>
            </div>
          )}

          {p.howtoOpen && (
            <div className="howto">
              <div className="howto-head">
                <h4>How do I say…?</h4>
                <button className="icon-btn" onClick={p.onCloseHowto} title="Close"><X size={18} /></button>
              </div>
              <div className="howto-input">
                <input
                  autoFocus
                  value={p.howtoInput}
                  placeholder="Say it in English…"
                  onChange={(e) => p.onHowtoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      p.onRunHowto();
                    }
                  }}
                />
                <button className="btn btn-primary" disabled={p.howtoLoading || !p.howtoInput.trim()} onClick={p.onRunHowto}>
                  {p.howtoLoading ? <Loader2 className="cv2-spin" size={16} /> : 'Translate'}
                </button>
              </div>
              {p.howtoResult && p.howtoResult.spanish && (
                <div className="howto-result">
                  <div className="howto-es">{p.howtoResult.spanish}</div>
                  {p.howtoResult.note_en && <div className="howto-note">{p.howtoResult.note_en}</div>}
                  <div className="howto-actions">
                    <button className="fb-btn picked" onClick={() => p.onPickSuggestion(p.howtoResult!.spanish)}>
                      Use this
                    </button>
                  </div>
                </div>
              )}
              {p.howtoResult && !p.howtoResult.spanish && p.howtoResult.note_en && (
                <div className="howto-result"><div className="howto-note">{p.howtoResult.note_en}</div></div>
              )}
            </div>
          )}

          {p.composerOpen && (
            <div className="composer">
              <button className="comp-x" onClick={p.onCloseComposer} title="Close"><X size={18} /></button>
              <textarea
                ref={p.taRef}
                rows={1}
                value={p.composerText}
                placeholder="Type in Spanish…"
                onChange={(e) => {
                  p.onComposerChange(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    p.onSend();
                  }
                }}
              />
              <button className="comp-send" disabled={!p.composerText.trim() || p.sending} onClick={p.onSend}>
                {p.sending ? <Loader2 className="cv2-spin" size={18} /> : <Send size={18} />}
              </button>
            </div>
          )}
        </div>

        <div className="controls-row">
          <button className="aux-pill" onClick={p.onHint} disabled={p.hintLoading}>
            {p.hintLoading ? <Loader2 className="cv2-spin" size={15} /> : <Lightbulb size={15} />} Stuck?
          </button>

          <VoiceCTA status={p.voiceStatus} onToggle={p.onToggleVoice} />

          <button
            className={'ghost-btn' + (p.composerOpen ? ' active' : '')}
            onClick={() => (p.composerOpen ? p.onCloseComposer() : p.onOpenComposer())}
            title="Type instead"
          >
            <Keyboard size={22} />
          </button>

          <button className={'aux-pill' + (p.howtoOpen ? ' on' : '')} onClick={p.onToggleHowto}>
            <HelpCircle size={15} /> How do I say…?
          </button>
        </div>

        <div className="dock-status">
          {p.voiceError ? <span className="cv2-error">{p.voiceError}</span> : p.chatError ? <span className="cv2-error">{p.chatError}</span> : p.status}
        </div>
      </div>

      {/* chat settings popover */}
      <div className="settings-anchor settings-corner">
        <button className="icon-btn settings-btn" onClick={p.onToggleChatSet} title="Settings"><Settings size={20} /></button>
        {p.chatSetOpen && (
          <ChatSettings prefs={p.chatPrefs} onPref={p.onChatPref} onClose={p.onCloseChatSet} />
        )}
      </div>

      {/* word popover */}
      {p.pop && (
        <span className="wordpop" style={{ left: p.pop.x, top: p.pop.y }} onClick={(e) => e.stopPropagation()}>
          <span className="es">{p.pop.word}</span>
          {p.pop.loading ? '…' : p.pop.text || '—'}
        </span>
      )}
    </div>
  );
}

function isTransVisibleSafe(p: ChatViewProps, m: ChatMessage): boolean {
  return p.isTransVisible(m.id);
}

function ChatSettings({
  prefs,
  onPref,
  onClose,
}: {
  prefs: { speed: string; difficulty: string; accent: string };
  onPref: (k: string, v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const seg = (key: string, val: string, opts: string[]) => (
    <div className="seg">
      {opts.map((o) => (
        <button key={o} className={'seg-btn' + (val === o ? ' on' : '')} onClick={() => onPref(key, o)}>
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div className="settings-pop" ref={ref}>
      <div className="settings-head">
        <h4>Conversation settings</h4>
        <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
      </div>
      <div className="settings-field">
        <div className="settings-flabel">Voice speed</div>
        {seg('speed', prefs.speed, ['Slower', 'Normal', 'Faster'])}
      </div>
      <div className="settings-field">
        <div className="settings-flabel">Word difficulty</div>
        {seg('difficulty', prefs.difficulty, ['Easier', 'Normal', 'Harder'])}
      </div>
      <div className="settings-field">
        <div className="settings-flabel">Tutor accent</div>
        <select className="settings-select" value={prefs.accent} onChange={(e) => onPref('accent', e.target.value)}>
          {ACCENT_OPTS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div className="settings-note">Preferences are saved on this device.</div>
    </div>
  );
}
