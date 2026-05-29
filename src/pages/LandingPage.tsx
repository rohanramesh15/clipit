import React, { memo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Puzzle,
  ArrowRight,
  Layers,
  Sun,
  Moon,
  X } from
'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
interface LandingPageProps {
  onNavigate: (view: 'login' | 'signup' | 'privacy') => void;
}
export function LandingPage({ onNavigate }: LandingPageProps) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });
  const [showDemoModal, setShowDemoModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    if (!showDemoModal && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [showDemoModal]);
  return (
    <div className={`min-h-screen bg-app text-primary font-sans selection:bg-accent selection:text-app overflow-x-hidden ${isDark ? '' : 'light'}`}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-app border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center">
            <img src={clipitLogo} alt="ClipIt" className="w-16 h-16 object-contain shrink-0 -mt-2" />
            <span className="text-5xl tracking-tight" style={{
              fontFamily: "'Love Ya Like A Sister', cursive",
              WebkitTextStroke: '2px #9E3B3B',
              paintOrder: 'stroke fill'
            }}>
              <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-10 h-10 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-secondary hover:text-primary transition-colors border border-white/5">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button
              onClick={() => onNavigate('login')}
              className="text-sm font-medium text-primary hover:text-accent transition-colors hidden sm:block">

              Log in
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="bg-white/10 hover:bg-white/20 text-primary px-5 py-2.5 rounded-lg text-sm font-bold transition-all border border-white/5">

              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            transition={{
              duration: 0.6
            }}>

            <h1 className="text-5xl md:text-7xl font-heading font-bold leading-tight mb-6">
              Clip it.<br />
              <span className="text-accent">
                Learn it.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-secondary mb-8 max-w-xl leading-relaxed">
              Watch anything. Pick up everything.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => onNavigate('signup')}
                className="bg-accent hover:bg-accent-hover text-app px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-accent/20 hover:shadow-accent/40 flex items-center justify-center gap-2">

                Start Learning Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowDemoModal(true)}
                className="bg-surface hover:bg-surface-hover border border-white/10 text-primary px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                <Play className="w-5 h-5 fill-current" />
                Watch Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-surface/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              How it works
            </h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              Three steps. No extra effort.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
            {
              icon: Play,
              title: 'Watch normally',
              desc: 'Browse YouTube and Netflix as per usual.',
              color: 'text-blue-500',
              bg: 'bg-blue-500/10'
            },
            {
              icon: Puzzle,
              title: 'Vocab captured',
              desc: 'The ClipIt extension picks up new words automatically.',
              color: 'text-accent',
              bg: 'bg-accent/10'
            },
            {
              icon: Layers,
              title: 'Review & Remember',
              desc: 'Flip through your cards whenever you are ready.',
              color: 'text-green-500',
              bg: 'bg-green-500/10'
            }].
            map((feature, i) =>
            <motion.div
              key={i}
              whileHover={{
                y: -5
              }}
              className="bg-surface border border-white/5 p-8 rounded-2xl hover:border-white/10 transition-colors">

                <div
                className={`w-14 h-14 rounded-xl ${feature.bg} ${feature.color} flex items-center justify-center mb-6`}>

                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-secondary leading-relaxed">{feature.desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-surface to-app border border-white/10 rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
              Ready to clip?
            </h2>
            <p className="text-xl text-secondary mb-10 max-w-2xl mx-auto">
              Your first word is one video away.
            </p>
            <button
              onClick={() => onNavigate('signup')}
              className="bg-accent hover:bg-accent-hover text-app px-10 py-5 rounded-xl font-bold text-xl transition-all shadow-xl shadow-accent/20 hover:scale-105">

              Get Started for Free
            </button>
            <p className="mt-6 text-sm text-muted">
              No credit card required • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-app">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center">
            <img src={clipitLogo} alt="ClipIt" className="w-10 h-10 object-contain shrink-0 -mt-1" />
            <span className="text-3xl tracking-tight" style={{
              fontFamily: "'Love Ya Like A Sister', cursive",
              WebkitTextStroke: '1.5px #9E3B3B',
              paintOrder: 'stroke fill'
            }}>
              <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
            </span>
          </div>
          <div className="flex gap-8 text-sm text-muted">
            <button onClick={() => onNavigate('privacy')} className="hover:text-secondary transition-colors">
              Privacy
            </button>
          </div>
          <p className="text-sm text-muted">© 2024 ClipIt Inc.</p>
        </div>
      </footer>

      {/* Demo Video Modal */}
      {showDemoModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowDemoModal(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowDemoModal(false)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm">
              <span>Close</span>
              <X className="w-5 h-5" />
            </button>
            <video
              ref={videoRef}
              src="/clipitdemo.mp4"
              controls
              autoPlay
              className="w-full rounded-2xl shadow-2xl"
            />
          </motion.div>
        </motion.div>
      )}
    </div>);

}