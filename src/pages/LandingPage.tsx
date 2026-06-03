import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  GalleryVerticalEnd,
  AudioLines,
  WandSparkles,
} from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';

interface LandingPageProps {
  onNavigate: (view: 'login' | 'signup' | 'privacy') => void;
}

const Logo = ({ size = 'text-5xl', img = 'w-16 h-16', stroke = '2px' }: { size?: string; img?: string; stroke?: string }) => (
  <div className="flex items-center">
    <img src={clipitLogo} alt="ClipIt" className={`${img} object-contain shrink-0 -mt-2`} />
    <span
      className={`${size} tracking-tight`}
      style={{ fontFamily: "'Love Ya Like A Sister', cursive", WebkitTextStroke: `${stroke} #9E3B3B`, paintOrder: 'stroke fill' }}
    >
      <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
    </span>
  </div>
);

const hairline = { borderTop: '1px solid var(--border-subtle)' };

export function LandingPage({ onNavigate }: LandingPageProps) {
  // Landing always renders in light mode (the default theme).
  useEffect(() => { localStorage.setItem('theme', 'light'); }, []);

  const modes = [
    { Icon: GalleryVerticalEnd, title: 'Flash Cards', desc: 'Spaced-repetition review, scheduled for the moment you’re about to forget.' },
    { Icon: AudioLines, title: 'Voice Chat', desc: 'Talk with an AI tutor that weaves your due words into real conversation.' },
    { Icon: WandSparkles, title: 'Mad Libs', desc: 'Drop your words back into the sentences from the videos you watched.' },
  ];

  const steps = [
    { n: '01', t: 'Watch as usual', d: 'Browse YouTube and Netflix like you always do.' },
    { n: '02', t: 'Words captured', d: 'The free ClipIt extension picks up new words automatically.' },
    { n: '03', t: 'Practice & remember', d: 'They become cards you review, speak, and play with.' },
  ];

  return (
    <div className="light min-h-screen bg-app text-primary font-sans selection:bg-accent selection:text-app overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-app">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-5">
            <button
              onClick={() => onNavigate('login')}
              className="text-sm font-medium text-secondary hover:text-primary transition-colors hidden sm:block"
            >
              Sign in
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4">
        {/* Hero */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-5xl md:text-7xl font-heading font-bold leading-[1.05] mb-6">
              Clip it. <span className="text-accent">Learn it.</span>
            </h1>
            <p className="text-lg md:text-xl text-secondary mb-10 max-w-xl leading-relaxed">
              Turn YouTube and Netflix content you already watch into vocabulary you actually remember.
            </p>
            <button
              onClick={() => onNavigate('signup')}
              className="bg-accent hover:bg-accent-hover text-app px-7 py-3.5 rounded-xl font-bold text-base transition-colors inline-flex items-center gap-2"
            >
              Start learning free <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </section>

        {/* How it works */}
        <section className="py-16" style={hairline}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {steps.map((s) => (
              <div key={s.n} className="bg-surface rounded-2xl p-7">
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-9 h-9 rounded-full bg-accent/10 text-accent font-heading font-bold text-sm flex items-center justify-center">
                    {s.n}
                  </span>
                  <span className="h-px flex-1" style={{ background: 'var(--border-subtle)' }} />
                </div>
                <p className="font-semibold text-primary mb-1.5">{s.t}</p>
                <p className="text-sm text-secondary leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Three ways to practice */}
        <section className="py-16" style={hairline}>
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-12">Three ways to practice</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {modes.map((m) => (
              <div key={m.title}>
                <m.Icon className="w-7 h-7 text-accent mb-4" strokeWidth={1.75} />
                <h3 className="font-heading font-bold text-lg text-primary mb-2">{m.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted mt-12">
            Korean · Ukrainian · Spanish &nbsp;·&nbsp; Bring your own Anki decks &nbsp;·&nbsp; Shared community lists &nbsp;·&nbsp; Streaks &amp; progress
          </p>
        </section>

        {/* CTA */}
        <section className="py-24 text-center" style={hairline}>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Ready to clip?</h2>
          <p className="text-secondary mb-9">Your first word is one video away.</p>
          <button
            onClick={() => onNavigate('signup')}
            className="bg-accent hover:bg-accent-hover text-app px-8 py-4 rounded-xl font-bold text-lg transition-colors"
          >
            Get started for free
          </button>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 bg-app" style={hairline}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Logo size="text-3xl" img="w-10 h-10" stroke="1.5px" />
          <div className="flex gap-6 text-sm text-muted">
            <button onClick={() => onNavigate('privacy')} className="hover:text-secondary transition-colors">Privacy</button>
          </div>
          <p className="text-sm text-muted">© 2026 ClipIt Inc.</p>
        </div>
      </footer>
    </div>
  );
}
