import React, { useState } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { supabase } from '../lib/supabaseClient';

interface ForgotPasswordPageProps {
  onNavigate: (view: 'landing' | 'login') => void;
}

const INPUT =
  'w-full rounded-xl bg-app border border-[var(--border-medium)] focus:border-accent focus:outline-none px-11 py-3.5 text-body-sm text-primary placeholder:text-muted transition-colors duration-150 ease-swift';
const LABEL = 'block text-meta font-semibold uppercase tracking-wider text-muted mb-2';

export function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout onBack={() => onNavigate('login')}>
      {success ? (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-14 h-14 text-accent" />
          </div>
          <h2 className="font-heading text-section text-primary mb-2">Check your email</h2>
          <p className="text-body-sm text-secondary mb-7">
            If an account exists with that email, we've sent a password reset link.
          </p>
          <button
            onClick={() => onNavigate('login')}
            className="font-semibold text-accent transition-colors duration-150 ease-swift hover:text-accent-hover"
          >
            Return to login
          </button>
        </div>
      ) : (
        <>
          <h2 className="font-heading text-section text-primary mb-1">Forgot password?</h2>
          <p className="text-body-sm text-secondary mb-7">Enter your email and we'll send you a reset link.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl px-4 py-3 text-body-sm text-red-500 bg-red-500/10">{error}</div>
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-colors duration-150 ease-swift flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
            </button>
          </form>

          <div className="mt-6 pt-6 text-center border-t border-subtle">
            <p className="text-body-sm text-secondary">
              Remembered it?{' '}
              <button onClick={() => onNavigate('login')} className="font-semibold text-accent transition-colors duration-150 ease-swift hover:text-accent-hover">
                Sign in
              </button>
            </p>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
