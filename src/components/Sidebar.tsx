import React, { useState } from 'react';
import {
  Play,
  Layers,
  BookOpen,
  BarChart3,
  Bird,
  MessageCircle,
  History,
  Sun,
  Moon } from
'lucide-react';
import { motion } from 'framer-motion';
type Page =
'video' |
'converse' |
'flashcards' |
'dictionary' |
'analytics' |
'settings';
interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}
export function Sidebar({
  activePage,
  onNavigate,
  isDark,
  onToggleTheme
}: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navItems = [
  {
    id: 'video',
    icon: History,
    label: 'History'
  },
  {
    id: 'converse',
    icon: MessageCircle,
    label: 'Converse'
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
    id: 'analytics',
    icon: BarChart3,
    label: 'Progress'
  }] as
  const;
  return (
    <nav className="fixed left-0 top-0 h-full w-20 md:w-64 bg-surface border-r border-white/5 flex flex-col z-50 transition-all duration-300">
      {/* Logo Area */}
      <div className="h-20 flex items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Bird className="w-5 h-5 text-app" />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight hidden md:block text-primary">
            Dead<span className="text-accent">bird</span>
          </span>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-8 flex flex-col gap-2 px-3">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={`
                group relative flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200
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


              <span
                className={`font-medium hidden md:block ${isActive ? 'text-primary' : ''}`}>

                {item.label}
              </span>
            </button>);

        })}
      </div>

      {/* Theme Toggle + User Profile */}
      <div className="p-4 border-t border-white/5 space-y-3">
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors text-secondary hover:text-primary">

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

              <Sun className="w-4 h-4 text-amber-500" />
              }
            </motion.div>
          </div>
          <span className="text-sm font-medium hidden md:block">
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>

        {/* User Profile */}
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${activePage === 'settings' ? 'bg-white/5' : 'hover:bg-white/5'}`}>

          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent to-orange-500 flex items-center justify-center text-xs font-bold text-app shrink-0">
            JD
          </div>
          <div className="hidden md:block overflow-hidden text-left">
            <p className="text-sm font-medium text-primary truncate">
              John Doe
            </p>
            <p className="text-xs text-secondary truncate">Pro Member</p>
          </div>
        </button>
      </div>
    </nav>);

}