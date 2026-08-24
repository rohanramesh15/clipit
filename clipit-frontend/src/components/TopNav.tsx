import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Check,
  BarChart3,
  History,
  Settings as SettingsIcon,
  LogOut,
  MessageSquare,
  Puzzle,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from './Avatar';
import { useHideOnScroll } from '../hooks/useHideOnScroll';
import clipitLogo from '../assets/clipitlogo.png';
import { Button } from './ui/button';

type Page =
  | 'video' | 'practice' | 'flashcards' | 'analytics'
  | 'vocabulary' | 'converse-v2' | 'madlibs' | 'settings';

// Pages reached through the Practice hub — none of them get a persistent nav
// pill (matches the new design: Practice is reached via the logo, Settings
// only via the account menu), so no active-state grouping is needed here.
const NAV_TABS: { id: Page; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'analytics', label: 'Progress', Icon: BarChart3 },
  { id: 'video', label: 'History', Icon: History },
];

const LANGUAGES = [
  { code: 'ko' as const, flag: '🇰🇷', name: 'Korean' },
  { code: 'uk' as const, flag: '🇺🇦', name: 'Ukrainian' },
];

const FEEDBACK_URL = 'https://forms.gle/5x6GJLDZKUTfJLTj9';
const EXTENSION_URL = 'https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn';

interface TopNavProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export function TopNav({ activePage, onNavigate }: TopNavProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLangPickerOpen, setIsLangPickerOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const langPickerRef = useRef<HTMLDivElement>(null);
  const isHidden = useHideOnScroll(8, 72, activePage);

  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';
  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  // Any open menu would slide off-screen with the bar, so dismiss them.
  useEffect(() => {
    if (!isHidden) return;
    setIsAccountOpen(false);
    setIsLangPickerOpen(false);
    setIsMobileOpen(false);
  }, [isHidden]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
      if (langPickerRef.current && !langPickerRef.current.contains(event.target as Node)) {
        setIsLangPickerOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setIsAccountOpen(false);
      setIsLangPickerOpen(false);
      setIsMobileOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <motion.header
      animate={{ y: isHidden ? '-100%' : '0%' }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      className="sticky top-0 z-50 bg-app"
    >
      <div className="mx-auto flex h-[72px] max-w-page items-center gap-6 px-5 sm:px-8">
        <Button
          type="button"
          onClick={() => onNavigate('practice')}
          variant="ghost"
          className="brand-logo h-auto shrink-0 gap-0 px-0 hover:bg-transparent"
        >
          <img src={clipitLogo} alt="" className="-mt-1 h-12 w-12 shrink-0 object-contain" />
          <span
            className="-ml-1 text-4xl leading-none tracking-tight"
            style={{ fontFamily: "'Love Ya Like A Sister', cursive", WebkitTextStroke: '2px #9E3B3B', paintOrder: 'stroke fill' }}
          >
            <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
          </span>
          <span className="sr-only">Go to practice home</span>
        </Button>

        <nav aria-label="Main" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {NAV_TABS.map((tab) => {
              const isActive = tab.id === activePage;
              return (
                <li key={tab.id}>
                  <Button
                    type="button"
                    onClick={() => onNavigate(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    variant="ghost"
                    size="sm"
                    className={`relative text-body-sm ${
                      isActive
                        ? 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent'
                        : 'hover:bg-transparent hover:text-secondary'
                    }`}
                  >
                    <tab.Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="relative hidden sm:block" ref={langPickerRef}>
            <Button
              type="button"
              onClick={() => {
                setIsLangPickerOpen((open) => !open);
                setIsAccountOpen(false);
              }}
              aria-expanded={isLangPickerOpen}
              aria-controls="language-picker"
              variant="secondary"
              size="sm"
              className="gap-2 hover:bg-surface"
            >
              <span aria-hidden="true">{currentLang.flag}</span>
              {currentLang.name}
              <ChevronDown
                className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isLangPickerOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              <span className="sr-only">Change the language you’re learning</span>
            </Button>

            <AnimatePresence>
              {isLangPickerOpen && (
                <motion.ul
                  id="language-picker"
                  aria-label="Language you’re learning"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute right-0 top-full z-50 mt-2 w-48 origin-top-right space-y-1 rounded-xl border border-subtle bg-app p-2 shadow-lg"
                >
                  {LANGUAGES.map((option) => {
                    const isSelected = option.code === language;
                    return (
                      <li key={option.code}>
                        <Button
                          type="button"
                          onClick={() => {
                            setLanguage(option.code);
                            setIsLangPickerOpen(false);
                          }}
                          aria-pressed={isSelected}
                          variant="ghost"
                          size="sm"
                          className={`w-full justify-start gap-3 ${
                            isSelected ? 'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent' : ''
                          }`}
                        >
                          <span aria-hidden="true">{option.flag}</span>
                          <span className="flex-1 text-left">{option.name}</span>
                          {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                        </Button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <div className="relative" ref={accountRef}>
            <Button
              type="button"
              onClick={() => {
                setIsAccountOpen((open) => !open);
                setIsLangPickerOpen(false);
              }}
              aria-expanded={isAccountOpen}
              aria-controls="account-menu"
              variant="ghost"
              className="h-10 gap-2 rounded-full p-1 pr-2"
            >
              <Avatar user={user} size={32} />
              <ChevronDown
                className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isAccountOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              <span className="sr-only">Account menu</span>
            </Button>

            <AnimatePresence>
              {isAccountOpen && (
                <motion.div
                  id="account-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl border border-subtle bg-app p-2 shadow-lg"
                >
                  <div className="border-b border-subtle px-3 pb-3 pt-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-semibold text-primary">{displayName}</p>
                      <p className="truncate text-meta text-muted">{user?.email ?? ''}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setIsAccountOpen(false);
                        onNavigate('settings');
                      }}
                      variant="ghost"
                      className="w-full justify-start"
                    >
                      <SettingsIcon className="h-4 w-4 text-muted" aria-hidden="true" />
                      Settings
                    </Button>

                    <a
                      href={EXTENSION_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsAccountOpen(false)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm font-medium text-primary transition-colors duration-150 ease-swift hover:bg-surface-hover"
                    >
                      <Puzzle className="h-4 w-4 text-muted" aria-hidden="true" />
                      <span className="flex-1 text-left">Get extension</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden="true" />
                    </a>
                    <a
                      href={FEEDBACK_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setIsAccountOpen(false)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-body-sm font-medium text-primary transition-colors duration-150 ease-swift hover:bg-surface-hover"
                    >
                      <MessageSquare className="h-4 w-4 text-muted" aria-hidden="true" />
                      Feedback
                    </a>
                    <Button
                      type="button"
                      onClick={() => {
                        setIsAccountOpen(false);
                        logout();
                      }}
                      variant="ghost"
                      className="group w-full justify-start hover:bg-error/10 hover:text-error"
                    >
                      <LogOut className="h-4 w-4 text-muted transition-colors duration-150 ease-swift group-hover:text-error" aria-hidden="true" />
                      Log out
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            type="button"
            onClick={() => setIsMobileOpen((open) => !open)}
            aria-expanded={isMobileOpen}
            aria-controls="mobile-main-navigation"
            aria-label="Toggle navigation"
            variant="ghost"
            size="icon"
            className="md:hidden"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.nav
            id="mobile-main-navigation"
            aria-label="Main"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden border-t border-subtle md:hidden"
          >
            <ul className="mx-auto max-w-page px-5 py-3 sm:px-8">
              {NAV_TABS.map((tab) => {
                const isActive = tab.id === activePage;
                return (
                  <li key={tab.id}>
                    <Button
                      type="button"
                      onClick={() => {
                        onNavigate(tab.id);
                        setIsMobileOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      variant="ghost"
                      size="lg"
                      className={`w-full justify-start ${
                        isActive
                          ? 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent'
                          : 'hover:bg-transparent hover:text-secondary'
                      }`}
                    >
                      <tab.Icon className="h-5 w-5" aria-hidden="true" />
                      {tab.label}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
