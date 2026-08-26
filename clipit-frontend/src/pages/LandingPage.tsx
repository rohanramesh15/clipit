import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import clipitLogo from '../assets/clipitlogo.png';
import { Hero } from '../components/landing/Hero';
import { HowItWorks } from '../components/landing/HowItWorks';
import { PracticeModes } from '../components/landing/PracticeModes';
import { Languages } from '../components/landing/Languages';
import { ClosingCTA } from '../components/landing/ClosingCTA';
import { useHideOnScroll } from '../hooks/useHideOnScroll';
import { Button } from '../components/ui/button';

interface LandingPageProps {
  onNavigate: (view: 'login' | 'signup' | 'privacy') => void;
}

const Logo = ({ size = 'text-5xl', img = 'w-16 h-16', stroke = '2px' }: { size?: string; img?: string; stroke?: string }) => (
  <div className="flex items-center">
    <img src={clipitLogo} alt="ClipIt" className={`${img} object-contain shrink-0 -mt-2`} />
    <span
      className={`${size} tracking-tight`}
      style={{ fontFamily: "'Love Ya Like A Sister', cursive", WebkitTextStroke: `${stroke} var(--logo-stroke)`, paintOrder: 'stroke fill' }}
    >
      <span className="text-logo-fill">lip</span><span className="text-cream">It</span>
    </span>
  </div>
);

export function LandingPage({ onNavigate }: LandingPageProps) {
  // Landing always renders in light mode (the default theme).
  useEffect(() => { localStorage.setItem('theme', 'light'); }, []);
  // Let the landing page use the platform's natural edge overscroll while
  // retaining the firmer scroll boundary used throughout the signed-in app.
  useEffect(() => {
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehaviorY;
    const previousBodyOverscroll = document.body.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = 'auto';
    document.body.style.overscrollBehaviorY = 'auto';

    return () => {
      document.documentElement.style.overscrollBehaviorY = previousHtmlOverscroll;
      document.body.style.overscrollBehaviorY = previousBodyOverscroll;
    };
  }, []);
  const isNavHidden = useHideOnScroll();

  return (
    <div className="light min-h-screen w-full overflow-x-hidden bg-app font-sans text-primary selection:bg-accent selection:text-white">
      {/* Nav */}
      <motion.header
        animate={{ y: isNavHidden ? '-100%' : '0%' }}
        transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
        className="fixed inset-x-0 top-0 z-50 bg-app"
      >
        <div className="mx-auto flex h-[72px] max-w-page items-center justify-between px-5 sm:px-8">
          <div className="brand-logo" aria-label="ClipIt">
            <Logo size="text-3xl" img="w-10 h-10" stroke="1.5px" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              onClick={() => onNavigate('login')}
              variant="ghost"
              className="hidden px-3 text-body font-medium hover:bg-transparent hover:text-secondary sm:inline-flex"
            >
              Sign in
            </Button>
            <Button
              onClick={() => onNavigate('signup')}
              className="text-body font-medium"
            >
              Sign up
            </Button>
          </div>
        </div>
      </motion.header>

      <main className="pt-[72px]">
        <Hero onGetStarted={() => onNavigate('signup')} />
        <HowItWorks />
        <PracticeModes />
        <Languages />
        <ClosingCTA onGetStarted={() => onNavigate('signup')} />
      </main>

      {/* Footer */}
      <footer className="bg-inverse py-10">
        <div className="mx-auto mb-10 max-w-page px-5 sm:px-8" aria-hidden="true">
          <div className="h-px bg-cream/20" />
        </div>
        <div className="mx-auto flex max-w-page flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <Logo size="text-3xl" img="w-10 h-10" stroke="1.5px" />
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
            <nav aria-label="Footer">
              <Button
                onClick={() => onNavigate('privacy')}
                variant="ghost"
                size="sm"
                className="px-0 text-cream/70 hover:bg-transparent hover:text-cream"
              >
                Privacy
              </Button>
            </nav>
            <p className="text-body-sm text-cream/60">© 2026 ClipIt Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
