import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { VideoPage } from './pages/VideoPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { DictionaryPage } from './pages/DictionaryPage';
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
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
import { ReviewSessionProvider } from './context/ReviewSessionContext';
import { HelpButton } from './components/HelpButton';
type Page =
'video' |
'flashcards' |
'dictionary' |
'analytics' |
'vocabulary' |
'settings';
type AppView = 'landing' | 'login' | 'signup' | 'onboarding' | 'app' | 'forgot-password' | 'reset-password' | 'privacy';

function AppInner() {
  const { user, isLoading } = useAuth();
  const [appView, setAppView] = useState<AppView>('landing');
  const [activePage, setActivePage] = useState<Page>('video');
  const [isDark, setIsDark] = useState(true);
  const [resetToken, setResetToken] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  const toggleSidebarCollapsed = () => {
    const newValue = !isSidebarCollapsed;
    setIsSidebarCollapsed(newValue);
    localStorage.setItem('sidebar_collapsed', String(newValue));
  };

  // Check URL for reset token and privacy page on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/privacy') {
      setAppView('privacy');
      return;
    }

    if (path === '/reset-password' || params.has('token')) {
      const token = params.get('token') || '';
      if (token) {
        setResetToken(token);
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
      setAppView((v) => (v === 'landing' || v === 'login' || v === 'signup' ? 'app' : v));
    } else {
      setAppView((v) => (v === 'reset-password' || v === 'forgot-password' || v === 'privacy' ? v : 'landing'));
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
      case 'flashcards':
        return <FlashcardsPage onNavigate={setActivePage} />;
      case 'dictionary':
        return <DictionaryPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'vocabulary':
        return <VocabularyUploadPage />;
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
    return <OnboardingPage onComplete={() => setAppView('app')} />;
  }
  if (appView === 'forgot-password') {
    return <ForgotPasswordPage onNavigate={setAppView} />;
  }
  if (appView === 'reset-password') {
    return <ResetPasswordPage token={resetToken} onNavigate={setAppView} />;
  }
  if (appView === 'privacy') {
    return <PrivacyPage onNavigate={setAppView} />;
  }

  // Main App View
  return (
    <HelpProvider>
      <ReviewSessionProvider>
        <div className="flex min-h-screen bg-app text-primary font-sans selection:bg-accent selection:text-app">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          isDark={isDark}
          onToggleTheme={() => setIsDark(!isDark)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed} />


        <motion.main
          className="flex-1 p-4 md:p-8 overflow-x-hidden"
          animate={{ marginLeft: isSidebarCollapsed ? 80 : 256 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}>
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
        </motion.main>

        {/* Help button - floating in bottom right */}
        <HelpButton />
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