import React, { useEffect, useState } from 'react';
import { TopNav } from './components/TopNav';
import { VideoPage } from './pages/VideoPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SettingsPage } from './pages/SettingsPage';
import { VocabularyUploadPage } from './pages/VocabularyUploadPage';
import { ConverseV2Page } from './pages/ConverseV2Page';
import { PracticePage } from './pages/PracticePage';
import { MadlibsPage } from './pages/MadlibsPage';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
import { ReviewSessionProvider } from './context/ReviewSessionContext';
type Page =
'video' |
'practice' |
'flashcards' |
'analytics' |
'vocabulary' |
'converse-v2' |
'madlibs' |
'settings';
type AppView = 'landing' | 'login' | 'signup' | 'onboarding' | 'app' | 'forgot-password' | 'reset-password' | 'privacy';

function AppInner() {
  const { user, isLoading, isNewUser } = useAuth();
  const [appView, setAppView] = useState<AppView>('landing');
  const [activePage, setActivePage] = useState<Page>('practice');

  // Check URL for reset token and privacy page on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/privacy') {
      setAppView('privacy');
      return;
    }

    if (path === '/reset-password' || params.has('code') || window.location.hash.includes('type=recovery')) {
      const token = params.get('code') || '';
      if (path === '/reset-password' || token || window.location.hash.includes('type=recovery')) {
        setAppView('reset-password');
        // Clean URL
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  // Sync appView with auth state
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      setAppView((v) => {
        if (v === 'landing' || v === 'login' || v === 'signup') {
          // Newly-created accounts (including Google's redirect flow, which
          // discards any page-local navigation state) go through onboarding
          // once; everyone else lands straight on Practice.
          if (isNewUser) return 'onboarding';
          setActivePage('practice');
          return 'app';
        }
        return v;
      });
    } else {
      setAppView((v) => (v === 'reset-password' || v === 'forgot-password' || v === 'privacy' ? v : 'landing'));
    }
  }, [isLoading, user, isNewUser]);
  // The app is light-only now — force the class/localStorage the same way
  // the landing page already does, so nothing can leave a stale 'dark' value
  // (e.g. from before this changed) lingering for the next visit.
  useEffect(() => {
    document.documentElement.classList.add('light');
    localStorage.setItem('theme', 'light');
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'video':
        return <VideoPage />;
      case 'practice':
        return <PracticePage onNavigate={setActivePage} />;
      case 'flashcards':
        return <FlashcardsPage onNavigate={setActivePage} />;
      case 'madlibs':
        return <MadlibsPage onNavigate={setActivePage} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'vocabulary':
        return <VocabularyUploadPage onBack={() => setActivePage('practice')} />;
      case 'converse-v2':
        return <ConverseV2Page onBack={() => setActivePage('practice')} onNavigate={setActivePage} />;
      case 'settings':
        return <SettingsPage onEditProfile={() => setAppView('onboarding')} />;
      default:
        return <VideoPage />;
    }
  };
  // Show loading state while checking auth - prevents landing page flash for logged-in users
  if (isLoading) {
    return <div className="min-h-screen bg-app" />;
  }

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
    return <OnboardingPage onComplete={() => { setActivePage('practice'); setAppView('app'); }} />;
  }
  if (appView === 'forgot-password') {
    return <ForgotPasswordPage onNavigate={setAppView} />;
  }
  if (appView === 'reset-password') {
    return <ResetPasswordPage onNavigate={setAppView} />;
  }
  if (appView === 'privacy') {
    return <PrivacyPage onNavigate={setAppView} />;
  }

  // Main App View
  return (
    <HelpProvider>
      <ReviewSessionProvider>
        <div className="min-h-screen w-full bg-app font-sans text-primary selection:bg-accent selection:text-app">
          <TopNav activePage={activePage} onNavigate={setActivePage} />

          <main className="p-4 md:p-8 overflow-x-hidden">
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
                }}>

                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </ReviewSessionProvider>
    </HelpProvider>
  );

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
