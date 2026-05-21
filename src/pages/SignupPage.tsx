import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, User, Loader2, Eye, EyeOff } from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

interface SignupPageProps {
  onNavigate: (view: 'landing' | 'login' | 'onboarding') => void;
}

export function SignupPage({ onNavigate }: SignupPageProps) {
  const { register, loginWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleGoogleSuccess = async (credential: string) => {
    setIsGoogleLoading(true);
    setError('');
    try {
      const { isNewUser } = await loginWithGoogle(credential, 'signup');
      onNavigate(isNewUser ? 'onboarding' : 'onboarding');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex flex-col lg:flex-row relative">
      {/* Mobile/Tablet Header */}
      <div className="lg:hidden flex items-center justify-between p-4 sm:p-6">
        <button
          onClick={() => onNavigate('landing')}
          className="p-2 text-[#E0D4D4]/60 hover:text-[#E0D4D4] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center">
          <img src={clipitLogo} alt="ClipIt" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
          <span className="text-2xl sm:text-3xl tracking-tight" style={{
            fontFamily: "'Love Ya Like A Sister', cursive",
            WebkitTextStroke: '1px #9E3B3B',
            paintOrder: 'stroke fill'
          }}>
            <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
          </span>
        </div>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>

      {/* Desktop Back Button */}
      <button
        onClick={() => onNavigate('landing')}
        className="hidden lg:block absolute left-16 xl:left-24 z-20 p-2 text-[#E0D4D4]/60 hover:text-[#E0D4D4] transition-colors"
        style={{ top: 'calc(50% - 280px)' }}
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Left Side - Branding (Desktop only) */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex lg:w-1/2 flex-col items-start justify-center p-16 xl:p-24 pb-32"
      >
        <div className="flex flex-col">
          <div className="flex items-center mb-4">
            <img src={clipitLogo} alt="ClipIt" className="w-32 h-32 object-contain shrink-0" />
            <span className="text-6xl tracking-tight" style={{
              fontFamily: "'Love Ya Like A Sister', cursive",
              WebkitTextStroke: '2px #9E3B3B',
              paintOrder: 'stroke fill'
            }}>
              <span style={{ color: '#EA7B7B' }}>lip</span><span style={{ color: '#FFEAD3' }}>It</span>
            </span>
          </div>

          <p className="max-w-lg leading-relaxed" style={{ color: '#E0D4D4', fontSize: '32px' }}>
            Learn Languages naturally through the content you love.
          </p>
        </div>
      </motion.div>

      {/* Right Side - Form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 lg:w-1/2 flex flex-col justify-center px-4 sm:px-8 py-6 lg:p-16 xl:p-24"
      >
        <div className="w-full max-w-md mx-auto">
          {/* Mobile/Tablet Tagline */}
          <p className="lg:hidden text-center text-lg sm:text-xl mb-6 leading-relaxed" style={{ color: '#E0D4D4', opacity: 0.8 }}>
            Learn Languages naturally through the content you love.
          </p>

          <div className="bg-[#1A1A1D] border border-[#E0D4D4]/10 rounded-2xl p-6 sm:p-8">
            {/* Google Sign Up */}
            <div className="mb-6">
              <GoogleSignInButton
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign-up was cancelled')}
                text="signup"
                isLoading={isGoogleLoading}
              />
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E0D4D4]/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#1A1A1D]" style={{ color: '#E0D4D4', opacity: 0.5 }}>or sign up with email</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#E0D4D4', opacity: 0.7 }}>
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#E0D4D4', opacity: 0.4 }} />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#0D0D0F] border border-[#E0D4D4]/10 rounded-xl py-3 sm:py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#E0D4D4]/30 transition-all"
                    style={{ color: '#E0D4D4' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#E0D4D4', opacity: 0.7 }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#E0D4D4', opacity: 0.4 }} />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0D0D0F] border border-[#E0D4D4]/10 rounded-xl py-3 sm:py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#E0D4D4]/30 transition-all"
                    style={{ color: '#E0D4D4' }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#E0D4D4', opacity: 0.7 }}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#E0D4D4', opacity: 0.4 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0D0D0F] border border-[#E0D4D4]/10 rounded-xl py-3 sm:py-3.5 pl-11 pr-11 text-sm focus:outline-none focus:border-[#E0D4D4]/30 transition-all"
                    style={{ color: '#E0D4D4' }}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#E0D4D4', opacity: 0.4 }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full bg-[#E07A7A] hover:bg-[#D06A6A] text-[#0D0D0F] font-semibold py-3 sm:py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#E0D4D4]/5 text-center">
              <p className="text-sm" style={{ color: '#E0D4D4', opacity: 0.6 }}>
                Already have an account?{' '}
                <button
                  onClick={() => onNavigate('login')}
                  className="font-semibold transition-colors"
                  style={{ color: '#E07A7A' }}
                >
                  Log in
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-xs mt-6 px-4" style={{ color: '#E0D4D4', opacity: 0.4 }}>
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
}
