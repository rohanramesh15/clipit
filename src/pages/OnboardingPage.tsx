import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bird,
  Play,
  Layers,
  MessageCircle,
  BarChart3,
  Zap,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  History } from
'lucide-react';
interface OnboardingPageProps {
  onComplete: () => void;
}
interface Slide {
  id: number;
  eyebrow: string;
  headline: string;
  body: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  researchNote?: {
    label: string;
    text: string;
  };
  visual?: 'forgetting-curve' | 'recall-bars' | 'features';
}
const slides: Slide[] = [
{
  id: 0,
  eyebrow: 'Welcome to lipIt',
  headline: "You're about to learn French the right way",
  body: "Most language apps waste your time with gamified nonsense. lipIt is built on decades of linguistics research — the same methods used by the world's fastest language learners.",
  icon: Bird,
  iconBg: 'bg-accent/20',
  iconColor: 'text-accent'
},
{
  id: 1,
  eyebrow: 'Method #1',
  headline: 'Comprehensible Input',
  body: 'Dr. Stephen Krashen\'s research shows we acquire language subconsciously when we understand messages slightly above our current level — called "i+1". Watching real French content is the most powerful input you can get.',
  icon: Play,
  iconBg: 'bg-blue-500/20',
  iconColor: 'text-blue-400',
  researchNote: {
    label: 'Krashen, 1982 — Input Hypothesis',
    text: 'Language is acquired, not learned. Comprehensible input at i+1 is the primary driver of fluency — not grammar drills.'
  }
},
{
  id: 2,
  eyebrow: 'Method #2',
  headline: 'Spaced Repetition System',
  body: 'Hermann Ebbinghaus discovered the "forgetting curve" in 1885 — we forget 70% of new information within 24 hours. SRS schedules reviews at the exact moment you\'re about to forget, making every minute of study maximally efficient.',
  icon: Layers,
  iconBg: 'bg-accent/20',
  iconColor: 'text-accent',
  researchNote: {
    label: 'Ebbinghaus, 1885 — Forgetting Curve',
    text: 'Spaced repetition can increase long-term retention from ~30% to over 90% with the same total study time.'
  },
  visual: 'forgetting-curve'
},
{
  id: 3,
  eyebrow: 'Method #3',
  headline: 'Active Recall',
  body: 'Simply re-reading vocabulary is passive and ineffective. Testing yourself forces your brain to actively retrieve information, strengthening neural pathways. Studies show active recall is 2–3× more effective than passive review.',
  icon: Zap,
  iconBg: 'bg-purple-500/20',
  iconColor: 'text-purple-400',
  researchNote: {
    label: 'Roediger & Karpicke, 2006 — The Testing Effect',
    text: 'Retrieval practice produces greater long-term retention than restudying, even without feedback.'
  },
  visual: 'recall-bars'
},
{
  id: 4,
  eyebrow: 'Method #4',
  headline: 'Input + Output = Fluency',
  body: "Input (watching, reading) builds understanding. Output (speaking, writing) forces you to produce language and notice gaps. Merrill Swain's Output Hypothesis shows that production is essential — not just consumption.",
  icon: MessageCircle,
  iconBg: 'bg-green-500/20',
  iconColor: 'text-green-400',
  researchNote: {
    label: 'Swain, 1985 — Output Hypothesis',
    text: 'Producing language pushes learners to notice gaps in their knowledge that input alone cannot address.'
  }
},
{
  id: 5,
  eyebrow: 'All set!',
  headline: 'Your French journey starts now',
  body: 'lipIt will analyze your watch history, build flashcards from your content, and track your progress — all automatically.',
  icon: CheckCircle2,
  iconBg: 'bg-accent/20',
  iconColor: 'text-accent',
  visual: 'features'
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
export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const slide = slides[current];
  const isLast = current === slides.length - 1;
  const goNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setDirection(1);
    setCurrent((c) => c + 1);
  };
  const goBack = () => {
    if (current === 0) return;
    setDirection(-1);
    setCurrent((c) => c - 1);
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
  return (
    <div className="min-h-screen bg-app flex flex-col text-primary font-sans">
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
        <button
          onClick={onComplete}
          className="text-sm text-secondary hover:text-primary transition-colors font-medium">

          Skip intro
        </button>
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
            <div
              className={`w-20 h-20 rounded-2xl ${slide.iconBg} ${slide.iconColor} flex items-center justify-center mx-auto mb-6 shadow-lg`}>

              <slide.icon className="w-10 h-10" />
            </div>

            {/* Eyebrow */}
            <p className="text-xs font-bold uppercase tracking-widest text-accent/80 mb-3">
              {slide.eyebrow}
            </p>

            {/* Headline */}
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary mb-5 leading-tight">
              {slide.headline}
            </h1>

            {/* Body */}
            <p className="text-lg text-secondary leading-relaxed max-w-xl mx-auto mb-6">
              {slide.body}
            </p>

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
        <button
          onClick={goBack}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${current === 0 ? 'invisible' : 'text-secondary hover:text-primary'}`}>

          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <span className="text-sm text-muted">
          {current + 1} of {slides.length}
        </span>

        <button
          onClick={goNext}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-app font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-accent/20 text-sm">

          {isLast ? 'Start Learning' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>);

}