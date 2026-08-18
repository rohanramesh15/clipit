import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;
const TOKEN_KEY = 'deadbird_token';
const REMEMBER_KEY = 'deadbird_remember';

// Get token from either storage
function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

// Clear token from both storages
function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string | null;
  profile_picture: string | null;
  is_active: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithGoogle: (credential: string, mode?: 'signin' | 'signup') => Promise<{ isNewUser: boolean }>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(!!getStoredToken());

  const fetchMe = useCallback(async (accessToken: string): Promise<AuthUser> => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Token invalid');
    return res.json();
  }, []);

  // On mount, validate any stored token
  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) { setIsLoading(false); return; }
    fetchMe(stored)
      .then((me) => { setUser(me); setToken(stored); })
      .catch(() => { clearStoredToken(); setToken(null); })
      .finally(() => setIsLoading(false));
  }, [fetchMe]);

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    const { access_token } = await res.json();
    // Clear any existing tokens first
    clearStoredToken();
    // Store based on rememberMe preference
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(REMEMBER_KEY, 'true');
    } else {
      sessionStorage.setItem(TOKEN_KEY, access_token);
    }
    setToken(access_token);
    const me = await fetchMe(access_token);
    setUser(me);
  };

  const loginWithGoogle = async (credential: string, mode: 'signin' | 'signup' = 'signin'): Promise<{ isNewUser: boolean }> => {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, mode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Google sign-in failed');
    }
    const { access_token, is_new_user } = await res.json();
    clearStoredToken();
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(REMEMBER_KEY, 'true');
    setToken(access_token);
    const me = await fetchMe(access_token);
    setUser(me);
    return { isNewUser: is_new_user };
  };

  const register = async (fullName: string, email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Registration failed');
    }
    const { access_token } = await res.json();
    localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
    const me = await fetchMe(access_token);
    setUser(me);
  };

  const logout = () => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
