import React, { useState } from 'react';
import { Lock, Loader2, CheckCircle } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { supabase } from '../lib/supabaseClient';

interface ResetPasswordPageProps {
  onNavigate: (view: 'landing' | 'login') => void;
}

const INPUT =
  'w-full rounded-xl bg-app border border-[var(--border-medium)] focus:border-accent focus:outline-none px-11 py-3.5 text-body-sm text-primary placeholder:text-muted transition-colors duration-150 ease-swift';
const LABEL = 'block text-meta font-semibold uppercase tracking-wider text-muted mb-2';

export function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
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
          <h2 className="font-heading text-section text-primary mb-2">Password reset!</h2>
          <p className="text-body-sm text-secondary mb-7">Your password has been successfully reset.</p>
          <button
            onClick={() => onNavigate('login')}
            className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-colors duration-150 ease-swift"
          >
            Sign in
          </button>
        </div>
      ) : (
        <>
          <h2 className="font-heading text-section text-primary mb-1">Reset password</h2>
          <p className="text-body-sm text-secondary mb-7">Enter your new password.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl px-4 py-3 text-body-sm text-red-500 bg-red-500/10">{error}</div>
            )}

            <div>
              <label className={LABEL}>New password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <label className={LABEL}>Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-colors duration-150 ease-swift flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-1"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset password'}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
