import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError?: () => void;
  text?: 'signin' | 'signup' | 'continue';
  isLoading?: boolean;
}

// Google "G" logo SVG
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue',
  isLoading = false
}: GoogleSignInButtonProps) {
  const hiddenButtonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef<((credential: string) => void) | null>(null);

  // Store the callback in a ref to avoid stale closures
  callbackRef.current = onSuccess;

  const buttonText = {
    signin: 'Sign in with Google',
    signup: 'Sign up with Google',
    continue: 'Continue with Google'
  }[text];

  // Initialize Google Identity Services
  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google?.accounts?.id && hiddenButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => {
            if (response.credential && callbackRef.current) {
              callbackRef.current(response.credential);
            }
          },
        });

        // Render the hidden Google button
        window.google.accounts.id.renderButton(
          hiddenButtonRef.current,
          {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            width: 300,
          }
        );
      }
    };

    // Check if google is already loaded
    if (window.google?.accounts?.id) {
      initializeGoogleSignIn();
    } else {
      // Wait for Google Identity Services to load
      const checkGoogle = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(checkGoogle);
          initializeGoogleSignIn();
        }
      }, 100);

      return () => clearInterval(checkGoogle);
    }
  }, []);

  const handleClick = () => {
    if (isLoading) return;

    // Try to click the hidden Google button
    const googleButton = hiddenButtonRef.current?.querySelector('[role="button"]') as HTMLElement;
    if (googleButton) {
      googleButton.click();
    } else {
      // Fallback: show the One Tap prompt
      window.google?.accounts?.id?.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          onError?.();
        }
      });
    }
  };

  return (
    <div className="relative">
      {/* Hidden Google button for triggering auth */}
      <div
        ref={hiddenButtonRef}
        className="absolute opacity-0 pointer-events-none -z-10"
        aria-hidden="true"
      />

      {/* Custom styled button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="w-full bg-transparent hover:bg-[#E0D4D4]/5 font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-3 border border-[#E0D4D4]/30 hover:border-[#E0D4D4]/50 disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ color: '#E0D4D4' }}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        ) : (
          <>
            <GoogleLogo className="w-5 h-5" />
            <span>{buttonText}</span>
          </>
        )}
      </button>
    </div>
  );
}

// Type declaration for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              type?: string;
              theme?: string;
              size?: string;
              width?: number;
            }
          ) => void;
          prompt: (callback?: (notification: {
            isNotDisplayed: () => boolean;
            isSkippedMoment: () => boolean;
          }) => void) => void;
        };
      };
    };
  }
}
