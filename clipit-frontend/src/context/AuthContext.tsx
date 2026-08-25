import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useIsRestoring } from '@tanstack/react-query';
import { API_BASE_URL } from '../config';
import { supabase } from '../lib/supabaseClient';
import { queryClient } from '../lib/queryClient';
import { queryPersister } from '../lib/queryPersister';
import { queryKeys } from '../lib/queries';
import { activateLocalLearningData, clearLocalLearningData } from '../lib/localLearningData';

const API_BASE = API_BASE_URL;

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  profile_picture: string | null;
  is_active: boolean;
}

interface MeResponse extends AuthUser {
  is_new_user: boolean;
}

export type AuthErrorCode = 'no_account' | 'account_exists';

// Thrown by fetchMe when the backend refused a Google sign-in/sign-up
// because it doesn't match the intent the user actually clicked.
class AuthIntentError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode) {
    super(code);
    this.code = code;
  }
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isNewUser: boolean;
  authError: AuthErrorCode | null;
  clearAuthError: () => void;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (intent?: 'signin' | 'signup') => Promise<{ isNewUser: boolean }>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Sticky within a session: once any request reports this login just created
  // the account, stays true even if a racing duplicate fetch reports false.
  const [isNewUser, setIsNewUser] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorCode | null>(null);
  const isRestoringCache = useIsRestoring();
  // Set once, synchronously, from the URL that a Google OAuth redirect lands
  // on. Supabase fires onAuthStateChange's INITIAL_SESSION event *and*
  // resolves getSession() on mount, and on a slow (cold-starting) backend
  // the first of those to reach the server can fully resolve — including a
  // "finally" cleanup — before the second one even calls applySession, so
  // clearing this after n calls, or after a fixed number of reads, can't be
  // made race-free. authUserId starts unbound (null) and locks to whichever
  // session first claims it, so every duplicate call for that *same* login
  // keeps getting the same verdict no matter how far apart they land; a
  // timeout (not a call count) discards it, generous enough to outlast any
  // realistic duplicate/retry but short enough to never reach an hourly
  // token refresh, which must not be intent-checked.
  const authIntentRef = useRef<{ intent: 'signin' | 'signup'; authUserId: string | null } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('auth_intent');
    if (intent === 'signin' || intent === 'signup') {
      authIntentRef.current = { intent, authUserId: null };
      params.delete('auth_intent');
      const search = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (search ? `?${search}` : '') + window.location.hash);
    }
  }, []);

  const clearCachedData = useCallback(() => {
    queryClient.clear();
    void queryPersister.removeClient();
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const fetchMe = useCallback(async (accessToken: string, authUserId: string, intent: 'signin' | 'signup' | null): Promise<MeResponse> => {
    return queryClient.fetchQuery({
      queryKey: queryKeys.profile(authUserId),
      queryFn: async ({ signal }) => {
        const url = new URL(`${API_BASE}/auth/me`);
        if (intent) url.searchParams.set('intent', intent);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        });
        if (res.status === 404) throw new AuthIntentError('no_account');
        if (res.status === 409) throw new AuthIntentError('account_exists');
        if (!res.ok) throw new Error('Token invalid');
        return res.json() as Promise<MeResponse>;
      },
    });
  }, []);

  useEffect(() => {
    if (isRestoringCache) return;
    let active = true;
    const applySession = async (accessToken: string | null, authUserId: string | null) => {
      if (!active) return;
      if (!accessToken || !authUserId) {
        clearCachedData();
        clearLocalLearningData();
        setUser(null);
        setToken(null);
        setIsNewUser(false);
        setIsLoading(false);
        return;
      }
      // The Supabase session is sufficient to enter the authenticated shell.
      // Keep the slower local-profile bridge off the critical rendering path;
      // pages that need the local numeric ID stay in their own loading state
      // until this request resolves.
      activateLocalLearningData(authUserId);
      setToken(accessToken);
      setAuthError(null);
      // Bind the pending intent to whichever session claims it first, so
      // every duplicate applySession call for that exact login — however
      // many, however far apart — replays the same verdict. A call for any
      // other session (a distinct, later sign-in in the same tab) leaves
      // intent null instead of reusing someone else's.
      const pending = authIntentRef.current;
      let intent: 'signin' | 'signup' | null = null;
      if (pending && (pending.authUserId === null || pending.authUserId === authUserId)) {
        intent = pending.intent;
        if (pending.authUserId === null) {
          pending.authUserId = authUserId;
          window.setTimeout(() => {
            if (authIntentRef.current === pending) authIntentRef.current = null;
          }, 30_000);
        }
      }
      // A fresh Google redirect with an intent to verify can still get
      // rejected below, so don't optimistically drop the loading state and
      // flash the authenticated shell for a result that's about to get torn
      // back down — hold isLoading until the verdict is in. Every other
      // sign-in keeps the fast path: shell renders immediately, profile
      // hydrates in the background.
      if (!intent) setIsLoading(false);
      try {
        const me = await fetchMe(accessToken, authUserId, intent);
        if (active) {
          setUser(me);
          if (me.is_new_user) setIsNewUser(true);
        }
      } catch (err) {
        if (active) {
          setUser(null);
          setToken(null);
          clearCachedData();
          clearLocalLearningData();
          await supabase.auth.signOut();
          if (err instanceof AuthIntentError) setAuthError(err.code);
        }
      } finally {
        if (intent && active) setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.access_token ?? null, session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => applySession(data.session?.access_token ?? null, data.session?.user.id ?? null));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [clearCachedData, fetchMe, isRestoringCache]);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    void rememberMe; // Supabase owns secure session persistence.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message || 'Login failed');
    activateLocalLearningData(data.session.user.id);
    setToken(data.session.access_token);
    setIsLoading(false);
    // onAuthStateChange performs the single, shared /auth/me bridge request.
  };

  const loginWithGoogle = async (intent?: 'signin' | 'signup'): Promise<{ isNewUser: boolean }> => {
    // Google's redirect discards in-memory state, so the clicked intent has
    // to travel as a URL param and get picked back up once the browser
    // returns — see the auth_intent effect above.
    const redirectTo = new URL(window.location.origin);
    if (intent) redirectTo.searchParams.set('auth_intent', intent);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) throw new Error(error.message);
    // The browser navigates to the provider. This return is only reached if
    // navigation is prevented by the browser or provider configuration.
    return { isNewUser: false };
  };

  const register = async (fullName: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('Check your email to confirm your account before signing in');
    activateLocalLearningData(data.session.user.id);
    setToken(data.session.access_token);
    setIsLoading(false);
    setIsNewUser(true);
    // onAuthStateChange performs the single, shared /auth/me bridge request.
  };

  const logout = () => {
    void supabase.auth.signOut();
    clearCachedData();
    clearLocalLearningData();
    setToken(null);
    setUser(null);
    setIsNewUser(false);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isNewUser, authError, clearAuthError, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
