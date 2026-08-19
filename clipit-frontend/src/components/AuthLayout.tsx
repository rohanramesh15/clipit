import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';

function Logo() {
  return (
    <div className="flex items-center justify-center">
      <img src={clipitLogo} alt="ClipIt" className="w-14 h-14 object-contain shrink-0 -mt-1" />
      <span
        className="text-5xl tracking-tight"
        style={{ fontFamily: "'Love Ya Like A Sister', cursive", WebkitTextStroke: '1.5px #9E3B3B', paintOrder: 'stroke fill' }}
      >
        <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
      </span>
    </div>
  );
}

interface AuthLayoutProps {
  onBack: () => void;
  children: React.ReactNode;
}

/**
 * Shared shell for Sign in / Sign up. Matches the landing page: light mode,
 * app design tokens (bg-app / bg-surface / accent), a centered logo above a
 * single clean surface card, and a hairline-bordered, minimal aesthetic.
 */
export function AuthLayout({ onBack, children }: AuthLayoutProps) {
  return (
    <div className="light min-h-screen bg-app text-primary font-sans selection:bg-accent selection:text-app flex flex-col">
      {/* Top bar — back to landing */}
      <header className="h-20 shrink-0">
        <div className="max-w-md mx-auto px-6 h-full flex items-center">
          <button
            onClick={onBack}
            aria-label="Go back"
            className="inline-flex items-center justify-center w-9 h-9 -ml-2 rounded-lg text-secondary transition-colors duration-150 ease-swift hover:text-primary hover:bg-black/5"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Centered form */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <Logo />
          </div>
          <div className="bg-surface rounded-2xl p-7 sm:p-8" style={{ border: '1px solid var(--border-subtle)' }}>
            {children}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
