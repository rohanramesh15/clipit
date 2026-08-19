import React, { useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { FormError } from '../components/auth/FormError';
import { supabase } from '../lib/supabaseClient';

interface ResetPasswordPageProps {
  onNavigate: (view: 'landing' | 'login') => void;
}

export function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);

      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (done) {
    return (
      <AuthLayout
        onBack={() => onNavigate('login')}
        title="Password updated"
        subtitle="You're all set — sign in with your new password."
      >
        <div className="rounded-2xl border border-subtle bg-app p-5">
          <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden="true" />
          <p className="mt-3 text-body-sm text-secondary">Your password has been changed successfully.</p>
        </div>
        <div className="mt-4">
          <PrimaryButton type="button" onClick={() => onNavigate('login')}>
            Sign in
          </PrimaryButton>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      onBack={() => onNavigate('login')}
      title="Set a new password"
      subtitle="Choose something you haven't used on ClipIt before."
      switchPrompt={{ text: 'Changed your mind?', linkLabel: 'Sign in', onClick: () => onNavigate('login') }}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <FormError message={error} />}

        <AuthField
          id="password"
          label="New password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          icon={Lock}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        <AuthField
          id="confirm"
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={setConfirmPassword}
          icon={Lock}
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          minLength={8}
        />

        <PrimaryButton isLoading={isLoading}>Update password</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
