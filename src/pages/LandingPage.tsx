import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Bird,
  Play,
  Mic,
  MessageCircle,
  ArrowRight,
  CheckCircle2 } from
'lucide-react';
interface LandingPageProps {
  onNavigate: (view: 'login' | 'signup') => void;
}
export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-app text-primary font-sans selection:bg-accent selection:text-app overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-app/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0 shadow-lg shadow-accent/20">
              <Bird className="w-6 h-6 text-app" />
            </div>
            <span className="font-heading font-bold text-2xl tracking-tight text-primary">
              Dead<span className="text-accent">bird</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('login')}
              className="text-sm font-medium text-secondary hover:text-primary transition-colors hidden sm:block">

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
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
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

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wider mb-6">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              New: Character Chat
            </div>
            <h1 className="text-5xl md:text-7xl font-heading font-bold leading-tight mb-6">
              Master French through{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-500">
                Immersion
              </span>
            </h1>
            <p className="text-lg md:text-xl text-secondary mb-8 max-w-xl leading-relaxed">
              Stop memorizing boring lists. Learn naturally by watching videos,
              shadowing native speakers, and chatting with AI characters.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => onNavigate('signup')}
                className="bg-accent hover:bg-accent-hover text-app px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg shadow-accent/20 hover:shadow-accent/40 flex items-center justify-center gap-2">

                Start Learning Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="bg-surface hover:bg-surface-hover border border-white/10 text-primary px-8 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                <Play className="w-5 h-5 fill-current" />
                Watch Demo
              </button>
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm text-muted">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) =>
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full border-2 border-app bg-gray-${i * 100 + 400}`} />

                )}
              </div>
              <p>Join 10,000+ learners today</p>
            </div>
          </motion.div>

          {/* Hero Visual */}
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.9
            }}
            animate={{
              opacity: 1,
              scale: 1
            }}
            transition={{
              duration: 0.8,
              delay: 0.2
            }}
            className="relative">

            <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 to-purple-500/20 rounded-3xl blur-3xl opacity-30" />
            <div className="relative bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden aspect-[4/3]">
              {/* Mock UI */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black p-6 flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-accent/20 text-accent flex items-center justify-center mx-auto mb-6 animate-pulse">
                      <Mic className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Speak with Confidence
                    </h3>
                    <p className="text-white/60">
                      AI analyzes your pronunciation in real-time
                    </p>
                  </div>
                </div>
                {/* Waveform */}
                <div className="h-16 flex items-end justify-center gap-1 opacity-50">
                  {Array.from({
                    length: 20
                  }).map((_, i) =>
                  <div
                    key={i}
                    className="w-2 bg-accent rounded-t-full"
                    style={{
                      height: `${Math.random() * 100}%`
                    }} />

                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-surface/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading font-bold mb-4">
              Everything you need to become fluent
            </h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              Our scientifically-proven method combines input, output, and
              feedback loops.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
            {
              icon: Play,
              title: 'Immersion Video',
              desc: 'Watch curated content from Netflix & YouTube with smart interactive subtitles.',
              color: 'text-blue-500',
              bg: 'bg-blue-500/10'
            },
            {
              icon: Mic,
              title: 'Shadow Practice',
              desc: 'Record yourself speaking and get instant AI feedback on your pronunciation.',
              color: 'text-accent',
              bg: 'bg-accent/10'
            },
            {
              icon: MessageCircle,
              title: 'Character Chat',
              desc: 'Have realistic conversations with fictional characters in text or voice mode.',
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
              Ready to start your journey?
            </h2>
            <p className="text-xl text-secondary mb-10 max-w-2xl mx-auto">
              Join thousands of students mastering French with lipIt today.
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
          <div className="flex items-center gap-2">
            <Bird className="w-5 h-5 text-accent" />
            <span className="font-bold text-primary">lipIt</span>
          </div>
          <div className="flex gap-8 text-sm text-secondary">
            <a href="#" className="hover:text-primary transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-primary transition-colors">
              Contact
            </a>
          </div>
          <p className="text-sm text-muted">© 2024 lipIt Inc.</p>
        </div>
      </footer>
    </div>);

}