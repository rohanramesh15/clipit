import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { VideoPage } from './pages/VideoPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ConversePage } from './pages/ConversePage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
type Page =
'video' |
'converse' |
'flashcards' |
'dictionary' |
'analytics' |
'settings';
type AppView = 'landing' | 'login' | 'signup' | 'onboarding' | 'app';

function AppInner() {
  const { user, isLoading } = useAuth();
  const [appView, setAppView] = useState<AppView>('landing');
  const [activePage, setActivePage] = useState<Page>('video');
  const [isDark, setIsDark] = useState(true);

  // Sync appView with auth state
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setAppView((v) => (v === 'landing' || v === 'login' || v === 'signup' ? 'app' : v));
    } else {
      setAppView('landing');
    }
  }, [isLoading, user]);
  // Apply theme class to <html> so it cascades to everything including fixed elements and body
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
    }
  }, [isDark]);
  const renderPage = () => {
    switch (activePage) {
      case 'video':
        return <VideoPage />;
      case 'converse':
        return <ConversePage />;
      case 'flashcards':
        return <FlashcardsPage />;
      case 'dictionary':
        return <DictionaryPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <VideoPage />;
    }
  };
  // Render top-level views
  if (appView === 'landing') {
    return <LandingPage onNavigate={setAppView} />;
  }
  if (appView === 'login') {
    return <LoginPage onNavigate={setAppView} />;
  }
  if (appView === 'signup') {
    return <SignupPage onNavigate={setAppView} />;
  }
  if (appView === 'onboarding') {
    return <OnboardingPage onComplete={() => setAppView('app')} />;
  }
  // Show nothing while checking stored token
  if (isLoading) {
    return <div className="min-h-screen bg-app" />;
  }

  // Main App View
  return (
    <div className="flex min-h-screen bg-app text-primary font-sans selection:bg-accent selection:text-app">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)} />


      <main className="flex-1 ml-20 md:ml-64 p-4 md:p-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePage}
            initial={{
              opacity: 0,
              x: 20
            }}
            animate={{
              opacity: 1,
              x: 0
            }}
            exit={{
              opacity: 0,
              x: -20
            }}
            transition={{
              duration: 0.3,
              ease: 'easeInOut'
            }}
            className="w-full max-w-7xl mx-auto">

            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>);

}

export function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppInner />
      </LanguageProvider>
    </AuthProvider>
  );
}