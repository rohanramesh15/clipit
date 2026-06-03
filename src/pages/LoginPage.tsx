import React, { useState } from 'react';
declare function gtag(...args: unknown[]): void;
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';

interface LoginPageProps {
  onNavigate: (view: 'landing' | 'signup' | 'app' | 'forgot-password') => void;
}

const INPUT_CLASS =
  'w-full rounded-xl py-3 sm:py-3.5 text-sm border border-[color:var(--auth-border)] focus:border-[color:var(--auth-border-strong)] focus:outline-none transition-all';
const INPUT_STYLE = { background: 'var(--auth-bg)', color: 'var(--auth-text)' } as const;

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password, rememberMe);
      gtag('event', 'conversion', {
        'send_to': 'AW-18115152337/s3QjCOHmyqEcENGT_b1D',
        'value': 0,
        'currency': 'USD'
      });
      onNavigate('app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setIsGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(credential, 'signin');
      gtag('event', 'conversion', {
        'send_to': 'AW-18115152337/s3QjCOHmyqEcENGT_b1D',
        'value': 0,
        'currency': 'USD'
      });
      onNavigate('app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthLayout onBack={() => onNavigate('landing')}>
      <h2 className="text-xl sm:text-2xl mb-6" style={{ color: 'var(--auth-text)' }}>
        Welcome back.
      </h2>

      {/* Google Sign In - Primary option */}
      <div className="mb-6">
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google sign-in was cancelled')}
          text="signin"
          isLoading={isGoogleLoading}
        />
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--auth-border)]"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4" style={{ background: 'var(--auth-surface)', color: 'var(--auth-text)', opacity: 0.7 }}>
            or sign in with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--auth-text)', opacity: 0.7 }}>
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--auth-text)', opacity: 0.55 }} />
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${INPUT_CLASS} pl-11 pr-4`}
              style={INPUT_STYLE}
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--auth-text)', opacity: 0.7 }}>
              Password
            </label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-xs font-medium"
              style={{ color: 'var(--auth-accent-text)' }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--auth-text)', opacity: 0.55 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT_CLASS} pl-11 pr-11`}
              style={INPUT_STYLE}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: 'var(--auth-text)', opacity: 0.55 }}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
            style={{
              background: rememberMe ? 'var(--auth-accent)' : 'transparent',
              borderColor: rememberMe ? 'var(--auth-accent)' : 'var(--auth-border-strong)',
            }}
          >
            {rememberMe && (
              <svg className="w-3 h-3" style={{ color: 'var(--auth-on-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <label
            onClick={() => setRememberMe(!rememberMe)}
            className="text-sm cursor-pointer select-none"
            style={{ color: 'var(--auth-text)', opacity: 0.7 }}
          >
            Remember me
          </label>
        </div>

        <button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full bg-[var(--auth-accent)] hover:bg-[var(--auth-accent-hover)] font-semibold py-3 sm:py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          style={{ color: 'var(--auth-on-accent)' }}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[color:var(--auth-border-faint)] text-center">
        <p className="text-sm" style={{ color: 'var(--auth-text)', opacity: 0.7 }}>
          Don't have an account?{' '}
          <button
            onClick={() => onNavigate('signup')}
            className="font-semibold transition-colors"
            style={{ color: 'var(--auth-accent-text)' }}
          >
            Sign up
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
