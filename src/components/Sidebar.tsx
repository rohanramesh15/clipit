import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Dumbbell,
  BarChart3,
  History,
  Sun,
  Moon,
  ChevronDown,
  PanelLeft,
  Check,
  Globe,
  Settings as SettingsIcon,
  LogOut,
  MessageSquare,
  Users } from
'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Avatar } from './Avatar';
type Page =
'video' |
'practice' |
'flashcards' |
'community' |
'analytics' |
'vocabulary' |
'converse-v2' |
'madlibs' |
'settings';

// Pages reached through the Practice hub — they all light up the Practice nav item.
const PRACTICE_PAGES: Page[] = ['practice', 'flashcards', 'converse-v2', 'madlibs'];
interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}
export function Sidebar({
  activePage,
  onNavigate,
  isDark,
  onToggleTheme,
  isCollapsed,
  onToggleCollapsed,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const displayName = user?.full_name || user?.email?.split('@')[0] || 'User';
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const FEEDBACK_URL = 'https://forms.gle/5x6GJLDZKUTfJLTj9';

  const languages = [
    { code: 'ko', flag: '🇰🇷', name: 'Korean' },
    { code: 'uk', flag: '🇺🇦', name: 'Ukrainian' },
    { code: 'es', flag: '🇪🇸', name: 'Spanish' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const navItems = [
  {
    id: 'practice',
    icon: Dumbbell,
    label: 'Practice'
  },
  {
    id: 'community',
    icon: Users,
    label: 'Community'
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Progress'
  },
  {
    id: 'video',
    icon: History,
    label: 'History'
  }] as
  const;
  return (
    <motion.nav
      className={`fixed left-0 top-0 h-full bg-app border-r border-white/5 flex flex-col z-50`}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
      {/* Logo Area */}
      <div className={`h-24 flex flex-col items-center justify-center relative`}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-start absolute inset-0 pl-6">
              <img src={clipitLogo} alt="ClipIt" className="w-16 h-16 object-contain shrink-0 -mt-2" />
              <span className="text-5xl tracking-tight hidden md:block" style={{
                fontFamily: "'Love Ya Like A Sister', cursive",
                WebkitTextStroke: '2px #9E3B3B',
                paintOrder: 'stroke fill'
              }}>
                <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {isCollapsed ? (
          // Collapsed: show the C logo; reveal the expand icon on hover.
          <button
            onClick={onToggleCollapsed}
            className="hidden md:flex group absolute inset-0 items-center justify-center rounded-lg transition-all z-10"
            title="Expand sidebar">
            <img
              src={clipitLogo}
              alt="ClipIt"
              className="w-11 h-11 object-contain transition-opacity duration-200 group-hover:opacity-0" />
            <PanelLeft className="w-6 h-6 absolute opacity-0 text-secondary transition-opacity duration-200 group-hover:opacity-100 group-hover:text-primary" />
          </button>
        ) : (
          <button
            onClick={onToggleCollapsed}
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-2 w-10 h-10 items-center justify-center rounded-lg hover:bg-white/5 text-secondary hover:text-primary transition-all z-10"
            title="Collapse sidebar">
            <PanelLeft className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <div className={`flex-1 py-8 flex flex-col gap-2 ${isCollapsed ? 'px-2 items-center' : 'px-3'}`}>
        {navItems.map((item) => {
          const isActive = item.id === 'practice'
            ? PRACTICE_PAGES.includes(activePage)
            : activePage === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={`
                group relative flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200
                ${isCollapsed ? 'justify-center w-12' : ''}
                ${isActive ? 'bg-white/5 text-accent' : 'text-secondary hover:text-primary hover:bg-white/5'}
              `}>

              <Icon
                className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`font-medium hidden md:block whitespace-nowrap ${isActive ? 'text-primary' : ''}`}>
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>);

        })}
      </div>

      {/* Theme Toggle + User Profile */}
      <div className={`p-4 space-y-3 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
        {/* Language Selector */}
        <div className="relative" ref={languageRef}>
          <button
            onClick={() => setIsLanguageOpen(!isLanguageOpen)}
            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-secondary hover:text-primary ${isCollapsed ? 'justify-center' : 'w-full'}`}>
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-lg">
              {currentLang.flag}
            </div>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="hidden md:flex items-center flex-1">
                  <span className="text-sm font-medium flex-1 text-left whitespace-nowrap">
                    {currentLang.name}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Popup */}
          {isLanguageOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[200px]">
              <div className="p-2 space-y-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code as 'ko' | 'uk' | 'es' | 'en');
                      setIsLanguageOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      language === lang.code
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-white/5 text-primary'
                    }`}>
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium flex-1 text-left whitespace-nowrap">{lang.name}</span>
                    {language === lang.code && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* User Profile — click to open account menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen((v) => !v)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isCollapsed ? 'justify-center' : 'w-full'} ${activePage === 'settings' || isProfileOpen ? 'bg-white/5' : 'hover:bg-white/5'}`}>

            <Avatar user={user} size={32} />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="hidden md:flex items-center flex-1 overflow-hidden text-left">
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-primary truncate whitespace-nowrap">
                      {displayName}
                    </p>
                    <p className="text-xs text-secondary truncate whitespace-nowrap">{user?.email ?? ''}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Account menu popup */}
          {isProfileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 min-w-[200px]">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => { setIsProfileOpen(false); onNavigate('settings'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-primary transition-colors">
                  <SettingsIcon className="w-4 h-4 shrink-0 text-secondary" />
                  <span className="font-medium text-sm text-left">Account settings</span>
                </button>
                <button
                  onClick={() => { setIsProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/5 text-primary hover:text-accent transition-colors">
                  <LogOut className="w-4 h-4 shrink-0 text-secondary" />
                  <span className="font-medium text-sm text-left">Log out</span>
                </button>
                <a
                  href={FEEDBACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsProfileOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-primary transition-colors">
                  <MessageSquare className="w-4 h-4 shrink-0 text-secondary" />
                  <span className="font-medium text-sm text-left">Feedback</span>
                </a>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.nav>);

}