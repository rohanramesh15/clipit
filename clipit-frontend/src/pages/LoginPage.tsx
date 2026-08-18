import React, { useState } from 'react';
declare function gtag(...args: unknown[]): void;
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';

interface LoginPageProps {
  onNavigate: (view: 'landing' | 'signup' | 'app' | 'forgot-password') => void;
}

const INPUT =
  'w-full rounded-xl bg-app border border-[var(--border-medium)] focus:border-accent focus:outline-none px-11 py-3.5 text-sm text-primary placeholder:text-muted transition-colors';
const LABEL = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-2';

export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password, rememberMe);
      gtag('event', 'conversion', { send_to: 'AW-18115152337/s3QjCOHmyqEcENGT_b1D', value: 0, currency: 'USD' });
      onNavigate('app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout onBack={() => onNavigate('landing')}>
      <h2 className="text-2xl font-heading font-bold text-primary mb-1">Welcome back</h2>
      <p className="text-sm text-secondary mb-7">Sign in to keep learning.</p>

      {/* Google — primary option */}
      <GoogleSignInButton
        onError={() => setError('Google sign-in was cancelled')}
        text="signin"
      />

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: '1px solid var(--border-subtle)' }} />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 text-xs text-muted bg-surface">or with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-500 bg-red-500/10">{error}</div>
        )}

        <div>
          <label className={LABEL}>Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={LABEL + ' mb-0'}>Password</label>
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT + ' pr-11'}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className="w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0"
            style={{
              background: rememberMe ? 'var(--accent)' : 'transparent',
              border: `1.5px solid ${rememberMe ? 'var(--accent)' : 'var(--border-medium)'}`,
            }}
          >
            {rememberMe && (
              <svg className="w-3 h-3 text-app" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className="text-sm text-secondary" onClick={() => setRememberMe(!rememberMe)}>Remember me</span>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-sm text-secondary">
          Don't have an account?{' '}
          <button onClick={() => onNavigate('signup')} className="font-semibold text-accent hover:text-accent-hover transition-colors">
            Sign up
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
