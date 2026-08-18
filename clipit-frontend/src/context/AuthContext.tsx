import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { supabase } from '../lib/supabaseClient';

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

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isNewUser: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (credential?: string, mode?: 'signin' | 'signup') => Promise<{ isNewUser: boolean }>;
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

  const fetchMe = useCallback(async (accessToken: string): Promise<MeResponse> => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Token invalid');
    return res.json();
  }, []);

  useEffect(() => {
    let active = true;
    const applySession = async (accessToken: string | null) => {
      if (!active) return;
      if (!accessToken) {
        setUser(null);
        setToken(null);
        setIsNewUser(false);
        setIsLoading(false);
        return;
      }
      try {
        const me = await fetchMe(accessToken);
        if (active) {
          setUser(me);
          setToken(accessToken);
          if (me.is_new_user) setIsNewUser(true);
        }
      } catch {
        if (active) {
          setUser(null);
          setToken(null);
          await supabase.auth.signOut();
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.access_token ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => applySession(data.session?.access_token ?? null));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchMe]);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    void rememberMe; // Supabase owns secure session persistence.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message || 'Login failed');
    const me = await fetchMe(data.session.access_token);
    setToken(data.session.access_token);
    setUser(me);
    if (me.is_new_user) setIsNewUser(true);
  };

  const loginWithGoogle = async (): Promise<{ isNewUser: boolean }> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
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
    const me = await fetchMe(data.session.access_token);
    setToken(data.session.access_token);
    setUser(me);
    setIsNewUser(true);
  };

  const logout = () => {
    void supabase.auth.signOut();
    setToken(null);
    setUser(null);
    setIsNewUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isNewUser, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
