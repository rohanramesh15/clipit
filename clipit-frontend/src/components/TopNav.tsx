import React, { useEffect, useState } from 'react';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

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
          <img src={clipitLogo} alt="" className="-mt-1 h-14 w-14 shrink-0 object-contain" />
          <span
            className="-ml-1 text-[2.75rem] leading-none tracking-tight"
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
                    size="default"
                    className={`relative text-body-sm ${
                      isActive
                        ? 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent'
                        : 'hover:bg-transparent hover:text-secondary'
                    }`}
                  >
                    <tab.Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="whitespace-nowrap text-body-sm">{tab.label}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <DropdownMenu open={isLangPickerOpen} onOpenChange={(open) => { setIsLangPickerOpen(open); if (open) setIsAccountOpen(false); }} className="hidden sm:block">
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm" className="h-auto gap-2 rounded-xl bg-app px-4 py-2 text-body-sm font-semibold text-primary hover:bg-app hover:text-primary">
                <span aria-hidden="true">{currentLang.flag}</span>
                {currentLang.name}
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isLangPickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                <span className="sr-only">Change the language you’re learning</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Language you’re learning" className="w-48">
              {LANGUAGES.map((option) => {
                const isSelected = option.code === language;
                return <DropdownMenuItem key={option.code} onSelect={() => setLanguage(option.code)} className={isSelected ? 'bg-accent-soft font-medium text-accent hover:bg-accent-soft hover:text-accent' : ''}>
                  <span aria-hidden="true">{option.flag}</span>
                  <span className="flex-1 text-left">{option.name}</span>
                  {isSelected && <Check className="h-4 w-4" aria-hidden="true" />}
                </DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu open={isAccountOpen} onOpenChange={(open) => { setIsAccountOpen(open); if (open) setIsLangPickerOpen(false); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-10 gap-2 rounded-full p-1 pr-2">
              <Avatar user={user} size={32} />
                <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-150 ease-swift ${isAccountOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                <span className="sr-only">Account menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 rounded-2xl">
              <DropdownMenuLabel className="border-b border-subtle">
                <div className="min-w-0"><p className="truncate text-body-sm font-semibold text-primary">{displayName}</p><p className="truncate text-meta text-muted">{user?.email ?? ''}</p></div>
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onNavigate('settings')}><SettingsIcon className="h-4 w-4 text-muted" aria-hidden="true" />Settings</DropdownMenuItem>
              <DropdownMenuItem asChild><a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer"><Puzzle className="h-4 w-4 text-muted" aria-hidden="true" /><span className="flex-1 text-left">Get extension</span><ExternalLink className="h-3.5 w-3.5 text-muted" aria-hidden="true" /></a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer"><MessageSquare className="h-4 w-4 text-muted" aria-hidden="true" />Feedback</a></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={logout} className="group hover:bg-error/10 hover:text-error"><LogOut className="h-4 w-4 text-muted transition-colors duration-150 ease-swift group-hover:text-error" aria-hidden="true" />Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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
