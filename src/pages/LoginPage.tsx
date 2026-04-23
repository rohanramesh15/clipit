import React, { useState } from 'react';
declare function gtag(...args: unknown[]): void;
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, Loader2 } from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import { useAuth } from '../context/AuthContext';
interface LoginPageProps {
  onNavigate: (view: 'landing' | 'signup' | 'app' | 'forgot-password') => void;
}
export function LoginPage({ onNavigate }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const isDark = localStorage.getItem('theme') !== 'light';
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(email, password, rememberMe);
      gtag('event', 'conversion', {
        'send_to': 'AW-18115152337/s3QjCOHmyqEcENGT_b1D',
        'value': 0,
        'currency': 'USD'
      });
      onNavigate('app');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className={`min-h-screen bg-app flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? '' : 'light'}`}>
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{
          opacity: 0,
          y: 20
        }}
        animate={{
          opacity: 1,
          y: 0
        }}
        className="w-full max-w-md z-10">

        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-8 text-sm font-medium">

          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="bg-surface border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl">
          <div className="flex justify-center mb-8">
            <img src={clipitLogo} alt="ClipIt" className="w-16 h-16 object-contain" />
          </div>

          <h1 className="text-2xl font-heading font-bold text-center text-primary mb-2">
            Welcome back
          </h1>
          <p className="text-secondary text-center mb-8">
            Enter your details to access your account
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                  required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-secondary uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-xs text-accent hover:text-accent-hover font-medium">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                  required />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  rememberMe
                    ? 'bg-accent border-accent'
                    : 'bg-transparent border-white/20 hover:border-white/40'
                }`}>
                {rememberMe && (
                  <svg className="w-3 h-3 text-app" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <label
                onClick={() => setRememberMe(!rememberMe)}
                className="text-sm text-secondary cursor-pointer select-none">
                Remember me
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">

              {isLoading ?
              <Loader2 className="w-5 h-5 animate-spin" /> :

              'Sign In'
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-secondary text-sm">
              Don't have an account?{' '}
              <button
                onClick={() => onNavigate('signup')}
                className="text-accent hover:text-accent-hover font-bold transition-colors">

                Sign up
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>);

}