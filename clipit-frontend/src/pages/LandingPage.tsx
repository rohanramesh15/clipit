import React, { useEffect } from 'react';
import clipitLogo from '../assets/clipitlogo.png';
import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { PracticeModes } from '../components/landing/PracticeModes';
import { Languages } from '../components/landing/Languages';
import { ClosingCTA } from '../components/landing/ClosingCTA';

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

export function LandingPage({ onNavigate }: LandingPageProps) {
  // Landing always renders in light mode (the default theme).
  useEffect(() => { localStorage.setItem('theme', 'light'); }, []);

  return (
    <div className="light min-h-screen w-full overflow-x-hidden bg-app font-sans text-primary selection:bg-accent selection:text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-app/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-page items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center" aria-label="ClipIt home">
            <Logo size="text-4xl" img="w-12 h-12" stroke="2px" />
          </a>

          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => onNavigate('login')}
              className="hidden whitespace-nowrap text-body font-medium text-secondary transition-colors duration-150 ease-swift hover:text-primary sm:block"
            >
              Sign in
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="whitespace-nowrap rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-[#fff] transition-colors duration-150 ease-swift hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      <main>
        <Hero onGetStarted={() => onNavigate('signup')} />
        <HowItWorks />
        <PracticeModes />
        <Languages />
        <ClosingCTA onGetStarted={() => onNavigate('signup')} />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-inverse py-10">
        <div className="mx-auto flex max-w-page flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <Logo size="text-2xl" img="w-8 h-8" stroke="1.5px" />
          <nav aria-label="Footer">
            <button
              onClick={() => onNavigate('privacy')}
              className="text-body-sm text-cream/70 transition-colors duration-150 ease-swift hover:text-cream"
            >
              Privacy
            </button>
          </nav>
          <p className="text-body-sm text-cream/60">© 2026 ClipIt Inc.</p>
        </div>
      </footer>
    </div>
  );
}
