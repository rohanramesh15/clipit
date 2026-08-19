import React, { useState } from 'react';
import { Mail, MailCheck } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { FormError } from '../components/auth/FormError';
import { supabase } from '../lib/supabaseClient';

interface ForgotPasswordPageProps {
  onNavigate: (view: 'landing' | 'login') => void;
}

export function ForgotPasswordPage({ onNavigate }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);

      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout
        onBack={() => onNavigate('login')}
        title="Check your email"
        subtitle={`If an account exists for ${email || 'that address'}, a reset link is on its way.`}
        switchPrompt={{ text: 'Remembered it?', linkLabel: 'Sign in', onClick: () => onNavigate('login') }}
      >
        <div className="rounded-2xl border border-subtle bg-app p-5">
          <MailCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          <p className="mt-3 text-body-sm text-secondary">
            Check your spam folder if it hasn't arrived in a few minutes.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 text-body-sm font-semibold text-accent-hover underline-offset-4 transition-colors duration-150 ease-swift hover:text-accent hover:underline"
          >
            Use a different email
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      onBack={() => onNavigate('login')}
      title="Forgot your password?"
      subtitle="Enter the email on your account and we'll send a reset link."
      switchPrompt={{ text: 'Remembered it?', linkLabel: 'Sign in', onClick: () => onNavigate('login') }}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <FormError message={error} />}

        <AuthField
          id="email"
          label="Email address"
          type="email"
          value={email}
          onChange={setEmail}
          icon={Mail}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <PrimaryButton isLoading={isLoading}>Send reset link</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
