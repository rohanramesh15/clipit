import { useEffect, useState } from 'react';
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
import { Skeleton } from './components/Skeleton';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
import { ReviewSessionProvider } from './context/ReviewSessionContext';
import { queryClient } from './lib/queryClient';
import { historyQueryOptions, homeQueueQueryOptions, reviewsQueryOptions, watchTimeQueryOptions } from './lib/queries';
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

// URL for each in-app page, so refresh/back/forward land on the same screen
// instead of always resetting to Practice. Auth-gated views (login, signup,
// onboarding) don't get their own path — they're transient, not something
// you'd want a reload to snap back to.
const PAGE_PATHS: Record<Page, string> = {
  practice: '/practice',
  video: '/history',
  flashcards: '/flashcards',
  analytics: '/progress',
  vocabulary: '/vocabulary',
  'converse-v2': '/converse',
  madlibs: '/madlibs',
  settings: '/settings',
};

function pageForPath(path: string): Page | null {
  const match = (Object.entries(PAGE_PATHS) as [Page, string][]).find(([, p]) => p === path);
  return match ? match[0] : null;
}

function AppLoadingState() {
  return (
    <div
      className="min-h-screen bg-app font-sans text-primary"
      role="status"
      aria-live="polite"
      aria-label="Loading your learning space"
    >
      <header className="border-b border-subtle bg-app/90">
        <div className="mx-auto flex h-[72px] max-w-page items-center gap-6 px-5 sm:px-8">
          <div className="flex items-center gap-2.5" aria-hidden="true">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
          <div className="hidden flex-1 gap-2 md:flex" aria-hidden="true">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
          <Skeleton className="ml-auto h-9 w-28 rounded-lg" />
        </div>
      </header>

      <main className="mx-auto max-w-page px-5 pb-8 pt-16 sm:px-8">
        <div className="max-w-xl">
          <Skeleton className="mb-4 h-9 w-64 rounded-lg" />
          <Skeleton className="h-5 w-80 max-w-full rounded-md" />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-2xl bg-surface p-5">
              <Skeleton className="mb-8 h-11 w-11 rounded-xl" />
              <Skeleton className="mb-3 h-5 w-28 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
            </div>
          ))}
        </div>

        <p className="mt-10 text-body-sm text-muted">Loading your learning space…</p>
      </main>
    </div>
  );
}

function AppInner() {
  const { user, token, isLoading, isNewUser } = useAuth();
  const { language } = useLanguage();
  // Lazy-initialize from the current URL so a page that was open before a
  // refresh renders straight away, with no flash of the landing/practice
  // default first. Whether this guess was actually valid (i.e. the user is
  // really authenticated) gets confirmed/corrected by the auth-sync effect
  // below once the session finishes loading.
  const [appView, setAppView] = useState<AppView>(() => {
    const path = window.location.pathname;
    if (path === '/privacy') return 'privacy';
    if (pageForPath(path)) return 'app';
    return 'landing';
  });
  const [activePage, setActivePage] = useState<Page>(() => pageForPath(window.location.pathname) || 'practice');

  // Wrap the raw setter so every in-app navigation also updates the URL -
  // this is what makes refresh/back/forward land on the same screen. Views
  // outside the main app (landing, login, signup, onboarding) stay
  // URL-less: they're transient pre-auth screens, not somewhere a reload
  // should snap back to.
  const navigateToPage = (page: Page) => {
    setActivePage(page);
    window.history.pushState({}, '', PAGE_PATHS[page]);
  };
  // Privacy is the one AppView (outside the main app) that also gets a real,
  // reload-safe URL - it's a standalone legal page people link to directly.
  const navigateToView = (view: AppView) => {
    setAppView(view);
    if (view === 'privacy') window.history.pushState({}, '', '/privacy');
  };

  // Check URL for reset token and privacy page on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/reset-password' || params.has('code') || window.location.hash.includes('type=recovery')) {
      const token = params.get('code') || '';
      if (path === '/reset-password' || token || window.location.hash.includes('type=recovery')) {
        setAppView('reset-password');
        // Clean URL
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  // Browser back/forward: re-derive the page from the URL the user landed on.
  useEffect(() => {
    const onPopState = () => {
      const page = pageForPath(window.location.pathname);
      if (page) setActivePage(page);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
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
          window.history.replaceState({}, '', PAGE_PATHS.practice);
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

  // History can be much taller than Home or Progress, and the landing page
  // is much taller than Privacy below it. Reset the document position as the
  // page or top-level view changes so the next, shorter screen is never
  // opened below its visible content.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activePage, appView]);

  // Populate the shared cache after sign-in. ensureQueryData only calls the
  // backend when a cache entry does not exist, including after an IndexedDB
  // restore, so returning users do not re-fetch this data on every visit.
  useEffect(() => {
    if (!user || !token) return;
    void Promise.allSettled([
      queryClient.ensureQueryData(historyQueryOptions(user.id, token, language)),
      queryClient.ensureQueryData(homeQueueQueryOptions(queryClient, user.id, token, language)),
      queryClient.ensureQueryData(watchTimeQueryOptions(user.id, token, language)),
      queryClient.ensureQueryData(reviewsQueryOptions(user.id, token)),
    ]);
  }, [language, token, user]);

  const renderPage = () => {
    switch (activePage) {
      case 'video':
        return <VideoPage />;
      case 'practice':
        return <PracticePage onNavigate={navigateToPage} />;
      case 'flashcards':
        return <FlashcardsPage onNavigate={navigateToPage} />;
      case 'madlibs':
        return <MadlibsPage onNavigate={navigateToPage} />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'vocabulary':
        return <VocabularyUploadPage onBack={() => navigateToPage('practice')} />;
      case 'converse-v2':
        return <ConverseV2Page onBack={() => navigateToPage('practice')} onNavigate={navigateToPage} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <VideoPage />;
    }
  };
  // Show loading state while checking auth - prevents landing page flash for logged-in users
  if (isLoading) {
    return <AppLoadingState />;
  }

  // Render top-level views
  if (appView === 'landing') {
    return <LandingPage onNavigate={navigateToView} />;
  }
  if (appView === 'login') {
    return <LoginPage onNavigate={setAppView} />;
  }
  if (appView === 'signup') {
    return <SignupPage onNavigate={setAppView} />;
  }
  if (appView === 'onboarding') {
    return <OnboardingPage onComplete={() => { navigateToPage('practice'); setAppView('app'); }} />;
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
          <TopNav activePage={activePage} onNavigate={navigateToPage} />

          <main className="p-4 md:p-8 overflow-x-hidden">
            <AnimatePresence initial={false} mode="popLayout">
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
