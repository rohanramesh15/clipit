import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Layers,
  BookOpen,
  BarChart3,
  History,
  Sun,
  Moon,
  ChevronDown,
  PanelLeft,
  Check,
  Globe,
  Upload,
  MessageSquare } from
'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
type Page =
'video' |
'flashcards' |
'dictionary' |
'analytics' |
'vocabulary' |
'settings';
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
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const initials = user?.full_name
    ? user.full_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? '?';
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'ko', flag: '🇰🇷', name: 'Korean' },
    { code: 'uk', flag: '🇺🇦', name: 'Ukrainian' },
  ];

  const currentLang = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setIsLanguageOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const navItems = [
  {
    id: 'video',
    icon: History,
    label: 'History'
  },
  {
    id: 'flashcards',
    icon: Layers,
    label: 'Practice'
  },
  {
    id: 'dictionary',
    icon: BookOpen,
    label: 'Dictionary'
  },
  {
    id: 'vocabulary',
    icon: Upload,
    label: 'Upload'
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Progress'
  }] as
  const;
  return (
    <motion.nav
      className={`fixed left-0 top-0 h-full bg-surface border-r border-white/5 flex flex-col z-50`}
      animate={{ width: isCollapsed ? 80 : 256 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
      {/* Logo Area */}
      <div className={`h-24 flex flex-col items-center justify-center border-b border-white/5 relative`}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center absolute inset-0 pr-4">
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
        <button
          onClick={onToggleCollapsed}
          className={`hidden md:flex absolute top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-lg hover:bg-white/5 text-secondary hover:text-primary transition-all z-10 ${
            isCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-2'
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <PanelLeft className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation Items */}
      <div className={`flex-1 py-8 flex flex-col gap-2 ${isCollapsed ? 'px-2 items-center' : 'px-3'}`}>
        {navItems.map((item) => {
          const isActive = activePage === item.id;
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

              {isActive &&
              <motion.div
                layoutId="active-nav"
                className="absolute left-0 w-1 h-6 bg-accent rounded-r-full"
                initial={{
                  opacity: 0
                }}
                animate={{
                  opacity: 1
                }}
                exit={{
                  opacity: 0
                }} />

              }

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
      <div className={`p-4 border-t border-white/5 space-y-3 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
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
              className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-2 space-y-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code as 'ko' | 'uk');
                      setIsLanguageOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      language === lang.code
                        ? 'bg-accent/10 text-accent'
                        : 'hover:bg-white/5 text-primary'
                    }`}>
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium flex-1 text-left">{lang.name}</span>
                    {language === lang.code && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-secondary hover:text-primary ${isCollapsed ? 'justify-center' : 'w-full'}`}>

          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
            <motion.div
              key={isDark ? 'moon' : 'sun'}
              initial={{
                y: -20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              exit={{
                y: 20,
                opacity: 0
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 20
              }}>

              {isDark ?
              <Moon className="w-4 h-4" /> :

              <Sun className="w-4 h-4" />
              }
            </motion.div>
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-medium hidden md:block whitespace-nowrap">
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Feedback Link */}
        <a
          href="https://forms.gle/5x6GJLDZKUTfJLTj9"
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-secondary hover:text-primary ${isCollapsed ? 'justify-center' : 'w-full'}`}>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-medium hidden md:block whitespace-nowrap">
                Feedback
              </motion.span>
            )}
          </AnimatePresence>
        </a>

        {/* User Profile */}
        <button
          onClick={() => onNavigate('settings')}
          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isCollapsed ? 'justify-center' : 'w-full'} ${activePage === 'settings' ? 'bg-white/5' : 'hover:bg-white/5'}`}>

          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-orange-500 flex items-center justify-center text-xs font-bold text-app shrink-0">
            {initials}
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="hidden md:block overflow-hidden text-left">
                <p className="text-sm font-medium text-primary truncate whitespace-nowrap">
                  {user?.full_name ?? user?.email ?? 'User'}
                </p>
                <p className="text-xs text-secondary truncate whitespace-nowrap">{user?.email ?? ''}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.nav>);

}