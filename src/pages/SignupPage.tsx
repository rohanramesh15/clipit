import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bird, ArrowLeft, Mail, Lock, User, Loader2 } from 'lucide-react';
interface SignupPageProps {
  onNavigate: (view: 'landing' | 'login' | 'onboarding') => void;
}
export function SignupPage({ onNavigate }: SignupPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      onNavigate('onboarding');
    }, 1500);
  };
  return (
    <div className="min-h-screen bg-app flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl" />
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
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/20">
              <Bird className="w-7 h-7 text-app" />
            </div>
          </div>

          <h1 className="text-2xl font-heading font-bold text-center text-primary mb-2">
            Create Account
          </h1>
          <p className="text-secondary text-center mb-8">
            Start your fluency journey today
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                  required />

              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                  required />

              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
                <input
                  type="password"
                  placeholder="Create a password"
                  className="w-full bg-app border border-white/10 rounded-xl py-3 pl-12 pr-4 text-primary placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                  required />

              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-hover text-app font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">

              {isLoading ?
              <Loader2 className="w-5 h-5 animate-spin" /> :

              'Create Account'
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-secondary text-sm">
              Already have an account?{' '}
              <button
                onClick={() => onNavigate('login')}
                className="text-accent hover:text-accent-hover font-bold transition-colors">

                Log in
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>);

}