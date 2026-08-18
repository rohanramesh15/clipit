import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';

interface SignupPageProps {
  onNavigate: (view: 'landing' | 'login' | 'onboarding') => void;
}

const INPUT =
  'w-full rounded-xl bg-app border border-[var(--border-medium)] focus:border-accent focus:outline-none px-11 py-3.5 text-sm text-primary placeholder:text-muted transition-colors';
const LABEL = 'block text-xs font-semibold uppercase tracking-wider text-muted mb-2';

export function SignupPage({ onNavigate }: SignupPageProps) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  return (
    <AuthLayout onBack={() => onNavigate('landing')}>
      <h2 className="text-2xl font-heading font-bold text-primary mb-1">Create your account</h2>
      <p className="text-sm text-secondary mb-7">Start learning from what you watch.</p>

      {/* Google — primary option */}
      <GoogleSignInButton
        onError={() => setError('Google sign-up was cancelled')}
        text="signup"
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
          <label className={LABEL}>Full name</label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={INPUT}
              required
            />
          </div>
        </div>

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
          <label className={LABEL}>Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={INPUT + ' pr-11'}
              required
              minLength={8}
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

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create account'}
        </button>
      </form>

      <div className="mt-6 pt-6 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-sm text-secondary">
          Already have an account?{' '}
          <button onClick={() => onNavigate('login')} className="font-semibold text-accent hover:text-accent-hover transition-colors">
            Sign in
          </button>
        </p>
      </div>
    </AuthLayout>
  );
}
