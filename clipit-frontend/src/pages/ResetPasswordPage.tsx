import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Loader2, CheckCircle } from 'lucide-react';
import clipitLogo from '../assets/clipitlogo.png';
import { supabase } from '../lib/supabaseClient';

interface ResetPasswordPageProps {
  onNavigate: (view: 'landing' | 'login') => void;
}

export function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const isDark = localStorage.getItem('theme') !== 'light';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
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
    <div className={`min-h-screen bg-app flex flex-col items-center justify-center p-6 relative overflow-hidden ${isDark ? '' : 'light'}`}>
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <button
          onClick={() => onNavigate('login')}
          className="flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-8 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>

        <div className="bg-surface border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl">
          <div className="flex justify-center mb-8">
            <img src={clipitLogo} alt="ClipIt" className="w-16 h-16 object-contain" />
          </div>

          {success ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-accent" />
              </div>
              <h1 className="text-2xl font-heading font-bold text-primary mb-2">
                Password Reset!
              </h1>
              <p className="text-secondary mb-6">
                Your password has been successfully reset.
              </p>
              <button
                onClick={() => onNavigate('login')}
                className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/20"
              >
                Sign In
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-heading font-bold text-center text-primary mb-2">
                Reset Password
              </h1>
              <p className="text-secondary text-center mb-8">
                Enter your new password
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      type="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
