import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Layers,
  MessageCircle,
  BarChart3,
  Zap,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  History,
  Sprout,
  Clock,
  Target,
  Trophy,
  Puzzle,
} from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import { Button } from '../components/ui/button';
import { useExtensionInstall } from '../components/ExtensionInstallModal';
import { FlashcardVisual, ChatVisual, MadlibsVisual } from '../components/PracticeModeVisuals';
import { NavigationIcon } from '../components/NavigationIconButton';

// YouTube Loop Player Component
function YouTubeLoopPlayer({ videoId, startTime, endTime }: { videoId: string; startTime: number; endTime: number }) {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      if (containerRef.current && window.YT && window.YT.Player) {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: startTime,
            end: endTime,
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => setIsReady(true),
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (event.data === window.YT.PlayerState.ENDED) {
                // Loop back to start
                playerRef.current?.seekTo(startTime, true);
                playerRef.current?.playVideo();
              }
              setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
            },
          },
        });
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      (window as any).onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      playerRef.current?.destroy();
    };
  }, [videoId, startTime, endTime]);

  const handlePlayClick = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.seekTo(startTime, true);
        playerRef.current.playVideo();
      }
    }
  };

  return (
    <div className="relative w-full max-w-lg mx-auto mt-6 rounded-2xl overflow-hidden bg-black aspect-video">
      <div ref={containerRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
      <button
        type="button"
        onClick={handlePlayClick}
        aria-label={isPlaying ? 'Pause video example' : 'Play video example'}
        aria-pressed={isPlaying}
        className="absolute bottom-3 left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {isPlaying ? <Pause className="h-5 w-5" aria-hidden="true" fill="currentColor" /> : <Play className="ml-0.5 h-5 w-5" aria-hidden="true" fill="currentColor" />}
      </button>
    </div>
  );
}

// Declare YouTube types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Compact, non-interactive versions of the real Practice page cards.
function SamplePracticeMethods() {
  const methods = [
    {
      label: 'Flash cards',
      description: 'Spaced-repetition review, scheduled for the moment you’re about to forget.',
      Visual: FlashcardVisual,
      surface: 'bg-sand-soft',
      heading: 'text-sand-deep',
      body: 'text-sand-ink',
    },
    {
      label: 'AI chat',
      description: 'Talk with a tutor that weaves your due words into real conversation.',
      Visual: ChatVisual,
      surface: 'bg-sage-soft',
      heading: 'text-sage-deep',
      body: 'text-sage-ink',
    },
    {
      label: 'Mad libs',
      description: 'Drop your words back into the sentences from the videos you watched.',
      Visual: MadlibsVisual,
      surface: 'bg-dusk-soft',
      heading: 'text-dusk-deep',
      body: 'text-dusk-ink',
    },
  ];

  return (
    <div className="mx-auto mt-7 grid w-full max-w-4xl gap-4 text-left md:grid-cols-3">
      {methods.map((method) => (
        <article key={method.label} className={`flex min-h-[17rem] flex-col rounded-2xl px-5 py-6 ${method.surface}`}>
          <div className="flex items-center gap-3">
            <h3 className={`font-heading text-card-title font-medium ${method.heading}`}>{method.label}</h3>
            <span className={`ml-auto inline-flex shrink-0 items-center rounded-xl p-2 ${method.heading}`} aria-hidden="true">
              <NavigationIcon direction="forward" />
            </span>
          </div>
          <p className={`mt-3 min-h-[4.75rem] text-body-sm ${method.body}`}>{method.description}</p>
          <div className="mt-auto pt-3"><method.Visual /></div>
        </article>
      ))}
    </div>
  );
}

interface OnboardingPageProps {
  onComplete: () => void;
}
interface Slide {
  id: number;
  eyebrow: string;
  headline: string;
  body?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  researchNote?: {
    label: string;
    text: string;
  };
  visual?: 'forgetting-curve' | 'recall-bars' | 'features';
  useClipLogo?: boolean;
  hideIcon?: boolean;
  video?: {
    videoId: string;
    startTime: number;
    endTime: number;
  };
  quote?: {
    text: string;
    author: string;
  };
  secondaryBody?: string;
  largeBody?: boolean;
  showPracticeMethods?: boolean;
  smallHeadline?: boolean;
}
const slides: Slide[] = [
{
  id: 0,
  eyebrow: '',
  headline: "Welcome to ClipIt",
  secondaryBody: "Learn a new language by watching Netflix & YouTube.",
  icon: Zap,
  iconBg: 'bg-accent/20',
  iconColor: 'text-accent',
  useClipLogo: true
},
{
  id: 1,
  eyebrow: '',
  headline: 'The Science Behind ClipIt',
  body: 'Just watch what you love.',
  icon: Play,
  iconBg: 'bg-transparent',
  iconColor: 'text-transparent',
  hideIcon: true,
  video: {
    videoId: 'NiTsduRreug',
    startTime: 291,
    endTime: 303
  },
  quote: {
    text: '"We acquire language in one way and only one way: when we understand messages. We call this comprehensible input."',
    author: 'Dr. Stephen Krashen, linguist & polyglot, USC'
  }
},
{
  id: 2,
  eyebrow: '',
  headline: 'Choose the way that helps each word stick.',
  body: 'Flashcards, AI chat, and Mad Libs turn words from your videos into practice.',
  icon: Layers,
  iconBg: 'bg-transparent',
  iconColor: 'text-transparent',
  hideIcon: true,
  largeBody: true,
  showPracticeMethods: true
},
{
  id: 3,
  eyebrow: '',
  headline: 'One last thing.',
  body: "Let's make it yours.",
  secondaryBody: 'A few quick questions so ClipIt knows how to work for you.',
  icon: Zap,
  iconBg: 'bg-transparent',
  iconColor: 'text-transparent',
  hideIcon: true,
  largeBody: true,
  smallHeadline: true
}];

const features = [
{
  icon: History,
  text: 'Watch history from YouTube & Netflix'
},
{
  icon: Layers,
  text: 'SRS flashcards from your content'
},
{
  icon: MessageCircle,
  text: 'AI character conversations'
},
{
  icon: BarChart3,
  text: 'Progress tracking & streaks'
}];

// Forgetting curve SVG
function ForgettingCurve() {
  return (
    <div className="w-full max-w-sm mx-auto mt-4">
      <svg viewBox="0 0 300 120" className="w-full">
        {/* Without SRS — steep decay */}
        <motion.path
          d="M 10 20 Q 60 25 100 60 Q 150 90 290 105"
          fill="none"
          stroke="rgba(239,68,68,0.6)"
          strokeWidth="2.5"
          strokeDasharray="300"
          initial={{
            strokeDashoffset: 300
          }}
          animate={{
            strokeDashoffset: 0
          }}
          transition={{
            duration: 1.2,
            ease: 'easeOut'
          }} />

        {/* With SRS — stepped recovery */}
        <motion.path
          d="M 10 20 Q 40 30 70 55 L 70 30 Q 100 38 130 58 L 130 35 Q 160 42 190 60 L 190 40 Q 220 46 260 55"
          fill="none"
          stroke="rgba(232,168,56,0.9)"
          strokeWidth="2.5"
          strokeDasharray="400"
          initial={{
            strokeDashoffset: 400
          }}
          animate={{
            strokeDashoffset: 0
          }}
          transition={{
            duration: 1.5,
            ease: 'easeOut',
            delay: 0.3
          }} />

        {/* Labels */}
        <text x="200" y="112" fontSize="9" fill="rgba(239,68,68,0.7)">
          Without SRS
        </text>
        <text x="200" y="50" fontSize="9" fill="rgba(232,168,56,0.9)">
          With SRS
        </text>
        <text x="8" y="115" fontSize="8" fill="rgba(255,255,255,0.3)">
          Day 1
        </text>
        <text x="255" y="115" fontSize="8" fill="rgba(255,255,255,0.3)">
          Day 30
        </text>
      </svg>
      <p className="text-center text-xs text-muted mt-1">
        Memory retention over time
      </p>
    </div>);

}
// Recall comparison bars
function RecallBars() {
  return (
    <div className="w-full max-w-xs mx-auto mt-4 space-y-3">
      {[
      {
        label: 'Passive Review',
        pct: 30,
        color: 'bg-white/20'
      },
      {
        label: 'Active Recall',
        pct: 80,
        color: 'bg-purple-500'
      }].
      map((bar) =>
      <div key={bar.label}>
          <div className="flex justify-between text-xs text-secondary mb-1">
            <span>{bar.label}</span>
            <span className="font-bold text-primary">{bar.pct}% retained</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
            className={`h-full ${bar.color} rounded-full`}
            initial={{
              width: 0
            }}
            animate={{
              width: `${bar.pct}%`
            }}
            transition={{
              duration: 0.8,
              ease: 'easeOut',
              delay: 0.2
            }} />

          </div>
        </div>
      )}
    </div>);

}
// Quiz questions
const quizQuestions = [
  {
    question: "What language are you learning?",
    options: [
      { label: "Korean", flag: "🇰🇷", value: "ko" },
      { label: "Ukrainian", flag: "🇺🇦", value: "uk" }
    ]
  },
  {
    question: "Set your daily goal",
    grid: true,
    columns: 2,
    options: [
      { label: "5 min", description: "≈ 10 cards a day", value: "5", icon: Sprout },
      { label: "15 min", description: "≈ 30 cards a day", value: "15", icon: Clock },
      { label: "30 min", description: "≈ 60 cards a day", value: "30", icon: Target },
      { label: "1 hour+", description: "≈ 120 cards a day", value: "60", icon: Trophy }
    ]
  },
  {
    question: "Install the ClipIt Extension",
    isExtensionStep: true,
    cards: [
      { label: "Browse normally", description: "Watch content on YouTube or Netflix", icon: Play },
      { label: "Vocab captured", description: "Extension detects new words", icon: Zap },
      { label: "Cards created", description: "Flashcards appear automatically", icon: Layers }
    ],
    options: []
  },
  {
    question: "You're all set!",
    isFinalStep: true,
    body: "Time to start learning from what you watch.",
    options: []
  }
];

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const { openExtensionInstall } = useExtensionInstall();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [inQuiz, setInQuiz] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const slide = slides[current];
  const isDark = localStorage.getItem('theme') !== 'light';
  const isLast = current === slides.length - 1;

  const goNext = () => {
    if (isLast) {
      setInQuiz(true);
      return;
    }
    setDirection(1);
    setCurrent((c) => c + 1);
  };
  const goBack = () => {
    if (inQuiz) {
      if (quizStep === 0) {
        setInQuiz(false);
      } else {
        setQuizStep((s) => s - 1);
      }
      return;
    }
    if (current === 0) return;
    setDirection(-1);
    setCurrent((c) => c - 1);
  };

  const handleOptionSelect = (value: string) => {
    setQuizAnswers((prev) => ({ ...prev, [quizStep]: value }));
  };

  const handleExtensionStepAdvance = () => {
    // Save answers to proper keys for Settings to read
    localStorage.setItem('onboarding_answers', JSON.stringify(quizAnswers));
    if (quizAnswers[0]) localStorage.setItem('deadbird_language', quizAnswers[0]); // Language
    if (quizAnswers[1]) localStorage.setItem('daily_goal', quizAnswers[1]); // Daily goal
    setQuizStep((s) => s + 1);
  };

  const handleNextStep = () => {
    if (!quizAnswers[quizStep]) return;
    if (quizStep === quizQuestions.length - 1) {
      // Save answers to proper keys for Settings to read
      localStorage.setItem('onboarding_answers', JSON.stringify(quizAnswers));
      if (quizAnswers[0]) localStorage.setItem('deadbird_language', quizAnswers[0]); // Language
      if (quizAnswers[1]) localStorage.setItem('daily_goal', quizAnswers[1]); // Daily goal
      onComplete();
    } else {
      setQuizStep((s) => s + 1);
    }
  };
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 280 : -280,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -280 : 280,
      opacity: 0
    })
  };
  // Quiz UI
  if (inQuiz) {
    const currentQuestion = quizQuestions[quizStep];
    return (
      <div className={`min-h-screen bg-app flex flex-col text-primary font-sans ${isDark ? '' : 'light'}`}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 md:px-10 pt-6 pb-2">
          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {quizQuestions.map((_, i) =>
            <motion.div
              key={i}
              layout
              className={`h-2 rounded-full transition-colors duration-300 ${i === quizStep ? 'bg-accent w-6' : i < quizStep ? 'bg-accent/40 w-2' : 'bg-white/10 w-2'}`} />
            )}
          </div>
        </div>

        {/* Quiz content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={quizStep}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl text-center"
            >
              <p className="text-body-sm text-secondary font-medium mb-4">
                Step {quizStep + 1} of {quizQuestions.length}
              </p>
              {'isExtensionStep' in currentQuestion && currentQuestion.isExtensionStep && (
                <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
                  <Puzzle className="w-8 h-8" />
                </div>
              )}

              {'isFinalStep' in currentQuestion && currentQuestion.isFinalStep && (
                <div className="w-16 h-16 rounded-full bg-accent/10 text-accent flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
              )}

              <h2 className="text-card-title font-heading font-medium text-primary mb-8 md:text-section">
                {currentQuestion.question}
              </h2>

              {'isExtensionStep' in currentQuestion && currentQuestion.isExtensionStep ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {'cards' in currentQuestion && currentQuestion.cards?.map((card, i) => (
                      <div
                        key={i}
                        className="bg-surface border border-white/10 rounded-2xl p-5 text-center"
                      >
                        <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mx-auto mb-3">
                          <card.icon className="w-6 h-6" />
                        </div>
                        <p className="font-semibold text-primary mb-1">{card.label}</p>
                        <p className="text-sm text-secondary">{card.description}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={openExtensionInstall}
                      className="inline-flex items-center justify-center gap-2 bg-accent text-on-accent hover:bg-accent-hover font-bold px-8 py-4 rounded-xl transition-all text-base"
                    >
                      <Puzzle className="w-5 h-5" />
                      Get the extension
                    </button>
                  </div>
                </div>
              ) : 'isFinalStep' in currentQuestion && currentQuestion.isFinalStep ? (
                <p className="text-lead text-secondary max-w-md mx-auto">
                  {currentQuestion.body}
                </p>
              ) : (
                <div className={`${'grid' in currentQuestion && currentQuestion.grid
                  ? `grid gap-4 ${'columns' in currentQuestion && currentQuestion.columns === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`
                  : 'space-y-3'}`}>
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleOptionSelect(option.value)}
                      className={`${'grid' in currentQuestion && currentQuestion.grid
                        ? `px-5 py-4 rounded-2xl border transition-all flex items-center gap-4 text-left ${
                            quizAnswers[quizStep] === option.value
                              ? 'bg-accent/10 border-accent text-primary'
                              : 'bg-surface border-white/10 hover:border-white/20 text-primary hover:bg-surface-hover'
                          }`
                        : `w-full p-4 rounded-xl border transition-all text-left flex items-center gap-4 ${
                            quizAnswers[quizStep] === option.value
                              ? 'bg-accent/10 border-accent text-primary'
                              : 'bg-surface border-white/10 hover:border-white/20 text-primary hover:bg-surface-hover'
                          }`
                      }`}
                    >
                      {'icon' in option && option.icon && (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          quizAnswers[quizStep] === option.value ? 'bg-accent/20 text-accent' : 'bg-white/10 text-secondary'
                        }`}>
                          <option.icon className="w-6 h-6" />
                        </div>
                      )}
                      {'flag' in option && (
                        <span className="text-2xl">{option.flag}</span>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold">{option.label}</p>
                        {'description' in option && (
                          <p className="text-sm text-secondary">{option.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between px-6 pb-8">
          <Button
            onClick={goBack}
            variant="ghost"
            className="font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          {'isExtensionStep' in quizQuestions[quizStep] && quizQuestions[quizStep].isExtensionStep ? (
            <Button
              onClick={handleExtensionStepAdvance}
              variant="ghost"
              className="font-medium"
            >
              Skip for now
            </Button>
          ) : 'isFinalStep' in quizQuestions[quizStep] && quizQuestions[quizStep].isFinalStep ? (
            <Button
              onClick={onComplete}
              size="lg"
              className="font-bold"
            >
              Begin learning
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleNextStep}
              disabled={!quizAnswers[quizStep]}
              size="lg"
              className="font-bold"
            >
              {quizStep === quizQuestions.length - 1 ? "Finish" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-app flex flex-col text-primary font-sans ${isDark ? '' : 'light'}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 md:px-10 pt-6 pb-2">
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {slides.map((_, i) =>
          <motion.div
            key={i}
            layout
            className={`h-2 rounded-full transition-colors duration-300 ${i === current ? 'bg-accent w-6' : i < current ? 'bg-accent/40 w-2' : 'bg-white/10 w-2'}`} />

          )}
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 32
            }}
            className="w-full max-w-2xl text-center">

            {/* Icon */}
            {slide.useClipLogo ? (
              <div className="flex justify-center mb-6">
                <img src={clipitLogo} alt="ClipIt" className="w-20 h-20 object-contain" />
              </div>
            ) : !slide.hideIcon ? (
              <div
                className={`w-20 h-20 rounded-2xl ${slide.iconBg} ${slide.iconColor} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                <slide.icon className="w-10 h-10" />
              </div>
            ) : null}

            {/* Eyebrow */}
            <p className="text-meta font-bold uppercase tracking-widest text-accent/80 mb-3">
              {slide.eyebrow}
            </p>

            {/* Headline */}
            <h1 className={`font-heading font-medium text-primary mb-5 leading-tight ${slide.smallHeadline ? 'text-card-title md:text-section' : 'text-section md:text-section-lg'}`}>
              {slide.headline}
            </h1>

            {/* Body */}
            {slide.body && (
              <p className={`leading-relaxed max-w-xl mx-auto mb-6 ${slide.video || slide.largeBody ? (slide.smallHeadline ? 'text-section md:text-section-lg text-primary' : 'text-card-title text-primary') : 'text-lead text-secondary'}`}>
                {slide.body}
              </p>
            )}

            {/* Practice method previews */}
            {slide.showPracticeMethods && <SamplePracticeMethods />}

            {/* Secondary Body */}
            {slide.secondaryBody && (
              <p className="text-body text-secondary leading-relaxed max-w-xl mx-auto mb-6">
                {slide.secondaryBody}
              </p>
            )}

            {/* Video */}
            {slide.video && (
              <YouTubeLoopPlayer
                videoId={slide.video.videoId}
                startTime={slide.video.startTime}
                endTime={slide.video.endTime}
              />
            )}

            {/* Quote */}
            {slide.quote && (
              <div className="mt-6 max-w-lg mx-auto">
                <p className="text-body text-secondary italic leading-relaxed">
                  {slide.quote.text}
                </p>
                <p className="text-body-sm text-muted mt-2">
                  — {slide.quote.author}
                </p>
              </div>
            )}

            {/* Visual */}
            {slide.visual === 'forgetting-curve' && <ForgettingCurve />}
            {slide.visual === 'recall-bars' && <RecallBars />}
            {slide.visual === 'features' &&
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 text-left">
                {features.map((f, i) =>
              <motion.div
                key={i}
                initial={{
                  opacity: 0,
                  y: 10
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                transition={{
                  delay: i * 0.1
                }}
                className="bg-surface border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">

                    <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <f.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {f.text}
                    </span>
                  </motion.div>
              )}
              </div>
            }

            {/* Research callout */}
            {slide.researchNote &&
            <motion.div
              initial={{
                opacity: 0,
                y: 8
              }}
              animate={{
                opacity: 1,
                y: 0
              }}
              transition={{
                delay: 0.3
              }}
              className="bg-surface border border-white/10 rounded-xl p-4 text-left max-w-xl mx-auto mt-6">

                <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                  📊 {slide.researchNote.label}
                </p>
                <p className="text-sm text-secondary italic leading-relaxed">
                  "{slide.researchNote.text}"
                </p>
              </motion.div>
            }
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="h-20 border-t border-white/5 flex items-center justify-between px-6 md:px-10">
          <Button
            type="button"
            onClick={goBack}
            disabled={current === 0}
            variant="ghost"
            className={`text-sm font-medium ${current === 0 ? 'invisible' : ''}`}>

          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <span className="text-sm text-muted">
          {current + 1} of {slides.length}
        </span>

        <Button
          onClick={goNext}
          className="text-sm font-bold">

          {isLast ? "Let's Go" : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>);

}
