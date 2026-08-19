import React, { useState } from 'react';
declare function gtag(...args: unknown[]): void;
import { Mail, Lock, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { AuthDivider } from '../components/auth/AuthDivider';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { FormError } from '../components/auth/FormError';

interface LoginPageProps {
  onNavigate: (view: 'landing' | 'signup' | 'app' | 'forgot-password') => void;
}

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
    <AuthLayout
      onBack={() => onNavigate('landing')}
      title="Welcome back"
      subtitle="Sign in to keep learning from what you watch."
      switchPrompt={{ text: 'New to ClipIt?', linkLabel: 'Create an account', onClick: () => onNavigate('signup') }}
    >
      <GoogleSignInButton onError={() => setError('Google sign-in was cancelled')} text="signin" />
      <AuthDivider label="or with email" />

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

        <AuthField
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          icon={Lock}
          placeholder="Enter your password"
          autoComplete="current-password"
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword(!showPassword)} />}
          labelAction={
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-meta font-semibold text-accent-hover underline-offset-4 transition-colors duration-150 ease-swift hover:text-accent hover:underline"
            >
              Forgot password?
            </button>
          }
        />

        <button
          type="button"
          onClick={() => setRememberMe(!rememberMe)}
          aria-pressed={rememberMe}
          className="flex items-center gap-2.5 rounded-lg py-0.5 text-body-sm text-secondary transition-colors duration-150 ease-swift hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span
            aria-hidden="true"
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ease-swift ${
              rememberMe ? 'border-accent bg-accent' : 'border-medium bg-app'
            }`}
          >
            {rememberMe && <Check className="h-3 w-3 text-[var(--on-accent)]" strokeWidth={3} />}
          </span>
          Keep me signed in
        </button>

        <PrimaryButton isLoading={isLoading}>Sign in</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
