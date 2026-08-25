import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleButton } from './auth/GoogleButton';

interface GoogleSignInButtonProps {
  onError?: () => void;
  text?: 'signin' | 'signup' | 'continue';
  isLoading?: boolean;
}

export function GoogleSignInButton({
  onError,
  text = 'continue',
  isLoading = false
}: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  const buttonText = {
    signin: 'Sign in with Google',
    signup: 'Sign up with Google',
    continue: 'Continue with Google'
  }[text];

  const handleClick = async () => {
    if (isLoading || redirecting) return;
    setRedirecting(true);
    try {
      await loginWithGoogle(text === 'continue' ? undefined : text);
    } catch {
      setRedirecting(false);
      onError?.();
    }
  };

  return <GoogleButton label={buttonText} onClick={handleClick} isLoading={isLoading || redirecting} />;
}
