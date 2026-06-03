import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';

interface SignupPageProps {
  onNavigate: (view: 'landing' | 'login' | 'onboarding') => void;
}

const INPUT_CLASS =
  'w-full rounded-xl py-3 sm:py-3.5 text-sm border border-[color:var(--auth-border)] focus:border-[color:var(--auth-border-strong)] focus:outline-none transition-all';
const INPUT_STYLE = { background: 'var(--auth-bg)', color: 'var(--auth-text)' } as const;
const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wider mb-2';
const LABEL_STYLE = { color: 'var(--auth-text)', opacity: 0.7 } as const;
const ICON_STYLE = { color: 'var(--auth-text)', opacity: 0.55 } as const;

export function SignupPage({ onNavigate }: SignupPageProps) {
  const { register, loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-dismiss the error message after a few seconds.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await register(fullName, email, password);
      onNavigate('onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setIsGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(credential, 'signup');
      onNavigate('onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <AuthLayout onBack={() => onNavigate('landing')}>
      <h2 className="text-xl sm:text-2xl mb-6" style={{ color: 'var(--auth-text)' }}>
        Create your account.
      </h2>

      {/* Google Sign Up */}
      <div className="mb-6">
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google sign-up was cancelled')}
          text="signup"
          isLoading={isGoogleLoading}
        />
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--auth-border)]"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4" style={{ background: 'var(--auth-surface)', color: 'var(--auth-text)', opacity: 0.7 }}>
            or sign up with email
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
          <label className={LABEL_CLASS} style={LABEL_STYLE}>Full Name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={ICON_STYLE} />
            <input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`${INPUT_CLASS} pl-11 pr-4`}
              style={INPUT_STYLE}
              required
            />
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS} style={LABEL_STYLE}>Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={ICON_STYLE} />
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
          <label className={LABEL_CLASS} style={LABEL_STYLE}>Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={ICON_STYLE} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${INPUT_CLASS} pl-11 pr-11`}
              style={INPUT_STYLE}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
              style={ICON_STYLE}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || isGoogleLoading}
          className="w-full bg-[var(--auth-accent)] hover:bg-[var(--auth-accent-hover)] font-semibold py-3 sm:py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          style={{ color: 'var(--auth-on-accent)' }}
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[color:var(--auth-border-faint)] text-center">
        <p className="text-sm" style={{ color: 'var(--auth-text)', opacity: 0.7 }}>
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('login')}
            className="font-semibold transition-colors"
            style={{ color: 'var(--auth-accent-text)' }}
          >
            Sign in
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
