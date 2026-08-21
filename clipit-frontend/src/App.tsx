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
import { PracticePageSkeleton } from './components/PracticePageSkeleton';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { HelpProvider } from './context/HelpContext';
import { ReviewSessionProvider } from './context/ReviewSessionContext';
import { queryClient } from './lib/queryClient';
import { historyQueryOptions, homeQueueQueryOptions, queryKeys } from './lib/queries';
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

const PAGE_TITLES: Record<Page, string> = {
  practice: 'Practice',
  video: 'History',
  flashcards: 'Flashcards',
  analytics: 'Progress',
  vocabulary: 'Vocabulary',
  'converse-v2': 'Conversation',
  madlibs: 'Mad Libs',
  settings: 'Settings',
};

const VIEW_TITLES: Partial<Record<AppView, string>> = {
  landing: 'Learn languages with video',
  login: 'Sign in',
  signup: 'Create account',
  onboarding: 'Set up your learning plan',
  'forgot-password': 'Reset password',
  'reset-password': 'Choose a new password',
  privacy: 'Privacy policy',
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
      <header className="h-[72px] border-b border-subtle bg-app/90" aria-hidden="true" />

      <main>
        <PracticePageSkeleton />
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
  // Auth views share the landing URL, but still get their own history entries.
  // That lets both the browser Back button and AuthLayout's back control return
  // to the exact auth screen a learner came from (for example Sign up → Sign in
  // → Back returns to Sign up rather than the landing page).
  const navigateToView = (view: AppView) => {
    setAppView(view);
    if (view === 'privacy') {
      window.history.pushState({}, '', '/privacy');
    } else if (view !== 'app' && view !== 'onboarding' && view !== 'reset-password') {
      window.history.pushState({ clipitView: view }, '', '/');
    }
  };

  const goBackFromAuth = () => {
    const state = window.history.state as { clipitView?: AppView } | null;
    if (state?.clipitView && window.history.length > 1) {
      window.history.back();
      return;
    }
    setAppView('landing');
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

  // Browser back/forward: restore the precise auth view when it is an
  // in-app history entry, otherwise derive the app page from the URL.
  useEffect(() => {
    const onPopState = () => {
      const state = window.history.state as { clipitView?: AppView } | null;
      if (state?.clipitView) {
        setAppView(state.clipitView);
        return;
      }
      const page = pageForPath(window.location.pathname);
      if (page) {
        setActivePage(page);
        setAppView('app');
        return;
      }
      if (window.location.pathname === '/privacy') {
        setAppView('privacy');
        return;
      }
      setAppView('landing');
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
    } else if (token) {
      // A Supabase session is already confirmed. Render the normal app shell
      // while /auth/me establishes the local profile and numeric user ID.
      // This avoids turning a slow backend wake-up into a blank login screen.
      setAppView((v) => {
        if (isNewUser) return v;
        if (v === 'landing' || v === 'login' || v === 'signup') {
          setActivePage('practice');
          window.history.replaceState({}, '', PAGE_PATHS.practice);
          return 'app';
        }
        return v;
      });
    } else {
      // A protected deep link such as /practice should fall back to the public
      // landing page at its canonical URL, rather than rendering the landing
      // page while leaving the authenticated route in the address bar.
      if (pageForPath(window.location.pathname)) {
        window.history.replaceState({}, '', '/');
      }
      setAppView((v) => (v === 'reset-password' || v === 'forgot-password' || v === 'privacy' ? v : 'landing'));
    }
  }, [isLoading, isNewUser, token, user]);
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

  // Announce SPA navigation through a meaningful document title and move the
  // keyboard cursor to the incoming page's main landmark.
  useEffect(() => {
    const title = appView === 'app' ? PAGE_TITLES[activePage] : VIEW_TITLES[appView];
    document.title = title ? `${title} | ClipIt` : 'ClipIt';
  }, [activePage, appView]);

  useEffect(() => {
    if (appView !== 'app') return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePage, appView]);

  // Populate only Home's first-visible data after sign-in. Progress data is
  // intentionally fetched when its tab is opened instead of competing with
  // the initial queue request on a cold backend.
  useEffect(() => {
    if (!user || !token) return;
    void queryClient.ensureQueryData(homeQueueQueryOptions(user.id, token, language));
  }, [language, token, user]);

  // The extension dispatches this event in open ClipIt tabs after its track
  // request succeeds. Fetch history right away so a newly watched video does
  // not wait for the normal polling interval or the persisted query cache.
  useEffect(() => {
    if (!user || !token) return;

    const refreshTrackedVideos = (event: Event) => {
      const { lang } = (event as CustomEvent<{ lang?: string }>).detail || {};
      if (lang && lang !== language) return;

      void queryClient.fetchQuery({
        ...historyQueryOptions(user.id, token, language),
        staleTime: 0,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.homeQueue(user.id, language) });
        queryClient.invalidateQueries({ queryKey: queryKeys.flashcardDashboard(user.id, language) });
        queryClient.invalidateQueries({ queryKey: queryKeys.watchTime(user.id, language) });
      }).catch(() => {});
    };

    window.addEventListener('clipit:video-tracked', refreshTrackedVideos);
    return () => window.removeEventListener('clipit:video-tracked', refreshTrackedVideos);
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
        return <SettingsPage onNavigate={navigateToPage} />;
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
    return <LoginPage onBack={goBackFromAuth} onNavigate={navigateToView} />;
  }
  if (appView === 'signup') {
    return <SignupPage onBack={goBackFromAuth} onNavigate={navigateToView} />;
  }
  if (appView === 'onboarding') {
    return <OnboardingPage onComplete={() => { navigateToPage('practice'); setAppView('app'); }} />;
  }
  if (appView === 'forgot-password') {
    return <ForgotPasswordPage onBack={goBackFromAuth} onNavigate={navigateToView} />;
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
          <a
            href="#main-content"
            className="sr-only fixed left-4 top-4 z-[100] rounded-lg bg-primary px-4 py-2 font-medium text-app focus:not-sr-only"
          >
            Skip to main content
          </a>
          <TopNav activePage={activePage} onNavigate={navigateToPage} />

          <main id="main-content" tabIndex={-1} className="p-4 md:p-8 overflow-x-clip focus:outline-none">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={activePage}
                initial={{
                  opacity: 0,
                  ...(activePage === 'settings' ? {} : { x: 20 }),
                }}
                animate={{
                  opacity: 1,
                  ...(activePage === 'settings' ? {} : { x: 0 }),
                }}
                exit={{
                  opacity: 0,
                  ...(activePage === 'settings' ? {} : { x: -20 }),
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
