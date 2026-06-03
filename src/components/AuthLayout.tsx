import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import './../pages/auth.css';

const TAGLINE = 'Learn Languages naturally through the content you love.';

function Logo({ size }: { size: 'sm' | 'lg' }) {
  const img = size === 'lg' ? 'w-40 h-40' : 'w-14 h-14';
  const text = size === 'lg' ? 'text-8xl' : 'text-4xl';
  const stroke = size === 'lg' ? '2px #9E3B3B' : '1px #9E3B3B';
  return (
    <div className="flex items-center">
      <img src={clipitLogo} alt="ClipIt" className={`${img} object-contain shrink-0`} />
      <span
        className={`${text} tracking-tight`}
        style={{
          fontFamily: "'Love Ya Like A Sister', cursive",
          WebkitTextStroke: stroke,
          paintOrder: 'stroke fill',
        }}
      >
        <span style={{ color: '#EA7B7B' }}>lip</span>
        <span style={{ color: '#FFEAD3' }}>It</span>
      </span>
    </div>
  );
}

interface AuthLayoutProps {
  onBack: () => void;
  children: React.ReactNode;
}

/**
 * Shared shell for the Sign in / Sign up pages.
 * Two-column on desktop (branding + form), single column on mobile.
 * Owns the page background, the top-right back button, and the form card so
 * both pages share identical alignment, spacing, and colors. Colors come from
 * the .auth-page palette in auth.css (light/dark aware).
 */
export function AuthLayout({ onBack, children }: AuthLayoutProps) {
  return (
    <div className="auth-page h-screen overflow-hidden flex flex-col lg:flex-row relative">
      {/* Back button — top left. On desktop it aligns with the branding column's
          left edge and the form card's top edge (both top-anchored at pt-28/32). */}
      <button
        onClick={onBack}
        aria-label="Go back"
        className="absolute top-5 left-5 sm:top-6 sm:left-6 lg:top-16 lg:left-16 xl:top-20 xl:left-24 z-20 -ml-2 lg:-mt-2 p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--auth-text)' }}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Left — branding (desktop only) */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex lg:w-1/2 flex-col items-start justify-start px-16 xl:px-24 pt-28 xl:pt-32"
      >
        <Logo size="lg" />
        <p
          className="max-w-md leading-relaxed mt-1 font-bold"
          style={{ color: 'var(--auth-text)', fontSize: '32px' }}
        >
          {TAGLINE}
        </p>
      </motion.div>

      {/* Right — form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 lg:w-1/2 flex flex-col justify-center lg:justify-start px-4 sm:px-8 py-16 lg:px-16 xl:px-24 lg:pt-16 xl:pt-20"
      >
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo + tagline */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <Logo size="sm" />
            <p className="text-base sm:text-lg mt-3 leading-relaxed font-bold opacity-80" style={{ color: 'var(--auth-text)' }}>
              {TAGLINE}
            </p>
          </div>

          <div
            className="rounded-2xl p-6 sm:p-8 border"
            style={{ background: 'var(--auth-surface)', borderColor: 'var(--auth-border)' }}
          >
            {children}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
