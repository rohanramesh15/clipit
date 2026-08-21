import React, { useState, useEffect } from 'react';
import { Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { AuthDivider } from '../components/auth/AuthDivider';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { FormError } from '../components/auth/FormError';

interface SignupPageProps {
  onNavigate: (view: 'landing' | 'login' | 'onboarding') => void;
}

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
      // App's central auth-state effect routes new accounts to onboarding —
      // it also has to handle Google's redirect flow, which discards any
      // page-local navigation like this, so email signup goes through the
      // same path for consistency rather than navigating here directly.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      onBack={() => onNavigate('landing')}
      title="Create your account"
      subtitle="Start turning what you watch into practice."
      switchPrompt={{ text: 'Already have an account?', linkLabel: 'Sign in', onClick: () => onNavigate('login') }}
      footerNote={
        <p className="text-meta text-muted">
          By creating an account you agree to our{' '}
          <a href="#privacy" className="font-medium text-secondary underline underline-offset-2 transition-colors duration-150 ease-swift hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>
      }
    >
      <GoogleSignInButton onError={() => setError('Google sign-up was cancelled')} text="signup" />
      <AuthDivider label="or with email" />

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <FormError message={error} />}

        <AuthField
          id="fullName"
          label="Full name"
          type="text"
          value={fullName}
          onChange={setFullName}
          icon={User}
          placeholder="John Doe"
          autoComplete="name"
        />

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

        <AuthField
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          icon={Lock}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          minLength={8}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
        />

        <PrimaryButton isLoading={isLoading}>Create account</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
