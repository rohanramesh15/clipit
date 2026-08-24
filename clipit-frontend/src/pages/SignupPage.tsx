import React, { useState } from 'react';
import { Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { AuthLayout } from '../components/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { PasswordToggle } from '../components/auth/PasswordToggle';
import { FormError } from '../components/auth/FormError';
import { Button } from '../components/ui/button';

interface SignupPageProps {
  onNavigate: (view: 'landing' | 'login' | 'onboarding') => void;
  onBack: () => void;
}

type Step = 'choose' | 'email';

export function SignupPage({ onNavigate, onBack }: SignupPageProps) {
  const { register } = useAuth();
  const [step, setStep] = useState<Step>('choose');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
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

  if (step === 'choose') {
    return (
      <AuthLayout
        onBack={onBack}
        title="Sign up"
        subtitle="Turn what you watch into practice."
        switchPrompt={{ text: 'Already have an account?', linkLabel: 'Sign in', onClick: () => onNavigate('login') }}
        footerNote={
          <p className="text-meta text-muted">
            By signing up, you agree to our{' '}
            <a href="#privacy" className="font-medium text-secondary underline underline-offset-2 transition-colors duration-150 ease-swift hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        }
      >
        <div className="space-y-3">
          <GoogleSignInButton onError={() => setError('Google sign-up was cancelled')} text="signup" />
          {error && <FormError message={error} />}
          <Button
            type="button"
            onClick={() => setStep('email')}
            variant="secondary"
            className="w-full"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Sign up with email
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      onBack={() => setStep('choose')}
      title="Sign up with email"
      subtitle="Just the basics."
      footerNote={
        <p className="text-meta text-muted">
          By signing up, you agree to our{' '}
          <a href="#privacy" className="font-medium text-secondary underline underline-offset-2 transition-colors duration-150 ease-swift hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <FormError message={error} />}

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="firstName"
            label="First name"
            type="text"
            value={firstName}
            onChange={setFirstName}
            icon={User}
            placeholder="Jane"
            autoComplete="given-name"
          />
          <AuthField
            id="lastName"
            label="Last name"
            type="text"
            value={lastName}
            onChange={setLastName}
            icon={User}
            placeholder="Doe"
            autoComplete="family-name"
          />
        </div>

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

        <AuthField
          id="confirmPassword"
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={setConfirmPassword}
          icon={Lock}
          placeholder="Re-enter password"
          autoComplete="new-password"
          minLength={8}
        />

        <PrimaryButton isLoading={isLoading}>Create account</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
