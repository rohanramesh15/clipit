import React from 'react';
import { motion } from 'framer-motion';
import clipitLogo from '../assets/clipitlogo.png';
import { NavigationIconButton } from './NavigationIconButton';

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

interface SwitchPrompt {
  text: string;
  linkLabel: string;
  onClick: () => void;
}

interface AuthLayoutProps {
  onBack: () => void;
  title: string;
  subtitle: string;
  /** Cross-link shown inside the card, right below its content (e.g. "New to ClipIt? Create an account"). */
  switchPrompt?: SwitchPrompt;
  /** Fine print shown outside the card, below everything (e.g. Terms/Privacy). */
  footerNote?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Shared shell for Sign in / Sign up / Forgot / Reset. Locked to the
 * viewport — a single centered column carrying the wordmark, the form
 * card, and the account cross-link. Nothing scrolls.
 */
export function AuthLayout({ onBack, title, subtitle, switchPrompt, footerNote, children }: AuthLayoutProps) {
  return (
    <div className="light flex h-screen w-full flex-col overflow-hidden bg-app font-sans text-primary selection:bg-accent selection:text-[var(--on-accent)]" style={{ height: '100dvh' }}>
      <header className="shrink-0 pt-5">
        <div className="mx-auto flex w-full max-w-page items-center px-5 sm:px-8">
          <NavigationIconButton direction="back" label="Go back" onClick={onBack} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-5 py-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="flex justify-center">
            <Logo />
          </div>

          <div className="mt-5 rounded-2xl border border-subtle bg-surface p-6 sm:p-7">
            <h1 className="font-heading text-section text-primary">{title}</h1>
            <p className="mt-1 text-body-sm text-secondary">{subtitle}</p>

            <div className="mt-6">{children}</div>

            {switchPrompt && (
              <p className="mt-5 text-center text-body-sm text-secondary">
                {switchPrompt.text}{' '}
                <button
                  type="button"
                  onClick={switchPrompt.onClick}
                  className="whitespace-nowrap font-semibold text-accent-hover underline-offset-4 transition-colors duration-150 ease-swift hover:text-accent hover:underline"
                >
                  {switchPrompt.linkLabel}
                </button>
              </p>
            )}
          </div>

          {footerNote && <div className="mt-5 text-center">{footerNote}</div>}
        </motion.div>
      </main>
    </div>
  );
}
