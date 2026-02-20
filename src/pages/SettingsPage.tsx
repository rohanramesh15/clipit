import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Shield,
  LogOut,
  Trash2,
  Youtube,
  Tv,
  Check,
  ChevronRight,
  Crown,
  Target } from
'lucide-react';
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DAILY_GOALS = [10, 15, 20, 30, 45, 60];
export function SettingsPage() {
  const [level, setLevel] = useState('B2');
  const [dailyGoal, setDailyGoal] = useState(20);
  const [notifications, setNotifications] = useState(true);
  const [youtubeConnected, setYoutubeConnected] = useState(true);
  const [netflixConnected, setNetflixConnected] = useState(false);
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20
      }}
      animate={{
        opacity: 1,
        y: 0
      }}
      transition={{
        duration: 0.4
      }}
      className="min-h-screen pb-20 max-w-3xl mx-auto px-4 pt-8">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-heading font-bold text-primary mb-2">
          Settings
        </h1>
        <p className="text-secondary">
          Manage your account, preferences, and integrations.
        </p>
      </div>

      <div className="space-y-10">
        {/* Profile */}
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Profile
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-accent to-orange-500 flex items-center justify-center text-xl font-bold text-app shrink-0">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-primary text-lg">John Doe</p>
              <p className="text-sm text-secondary">john@example.com</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Crown className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-accent">
                  Pro Member
                </span>
              </div>
            </div>
            <button className="text-sm font-medium text-secondary hover:text-primary transition-colors flex items-center gap-1 shrink-0 border border-white/10 px-4 py-2 rounded-lg hover:bg-white/5">
              Edit Profile <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* Learning Preferences */}
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Learning
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-6 space-y-6">
            {/* Level */}
            <div>
              <label className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> Current Level
              </label>
              <p className="text-xs text-secondary mb-3">
                Set your French proficiency level to calibrate content
                difficulty.
              </p>
              <div className="flex gap-2">
                {LEVELS.map((l) =>
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border ${level === l ? 'bg-accent text-app border-accent shadow-md shadow-accent/20' : 'bg-app/50 text-secondary border-white/5 hover:border-white/10 hover:text-primary'}`}>

                    {l}
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-white/5" />

            {/* Daily Goal */}
            <div>
              <label className="text-sm font-semibold text-primary mb-1 block">
                Daily Goal
              </label>
              <p className="text-xs text-secondary mb-3">
                How many minutes do you want to study each day?
              </p>
              <div className="flex gap-2 flex-wrap">
                {DAILY_GOALS.map((g) =>
                <button
                  key={g}
                  onClick={() => setDailyGoal(g)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${dailyGoal === g ? 'bg-accent text-app border-accent shadow-md shadow-accent/20' : 'bg-app/50 text-secondary border-white/5 hover:border-white/10 hover:text-primary'}`}>

                    {g}m
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Integrations
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl divide-y divide-white/5">
            {[
            {
              id: 'youtube',
              label: 'YouTube',
              desc: 'Sync your watch history to extract French vocabulary automatically.',
              icon: Youtube,
              color: 'text-red-500',
              bg: 'bg-red-500/10',
              connected: youtubeConnected,
              toggle: () => setYoutubeConnected(!youtubeConnected)
            },
            {
              id: 'netflix',
              label: 'Netflix',
              desc: 'Connect Netflix to track French shows and films you watch.',
              icon: Tv,
              color: 'text-red-700',
              bg: 'bg-red-700/10',
              connected: netflixConnected,
              toggle: () => setNetflixConnected(!netflixConnected)
            }].
            map((integration) =>
            <div
              key={integration.id}
              className="flex items-center justify-between p-5">

                <div className="flex items-center gap-4">
                  <div
                  className={`w-10 h-10 rounded-xl ${integration.bg} ${integration.color} flex items-center justify-center shrink-0`}>

                    <integration.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-primary">
                      {integration.label}
                    </p>
                    <p className="text-xs text-secondary mt-0.5">
                      {integration.desc}
                    </p>
                  </div>
                </div>
                <button
                onClick={integration.toggle}
                className={`ml-4 px-4 py-2 rounded-lg text-xs font-bold transition-all border shrink-0 ${integration.connected ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20' : 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'}`}>

                  {integration.connected ?
                <span className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> Connected
                    </span> :

                'Connect'
                }
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Notifications
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-primary">Daily Reminders</p>
                <p className="text-xs text-secondary mt-0.5">
                  Get nudged to hit your daily study goal
                </p>
              </div>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${notifications ? 'bg-accent' : 'bg-white/10'}`}>

              <motion.div
                animate={{
                  x: notifications ? 22 : 2
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30
                }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm" />

            </button>
          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Account
          </h2>
          <div className="bg-surface border border-white/5 rounded-2xl divide-y divide-white/5">
            <button className="w-full flex items-center gap-4 p-5 text-secondary hover:text-primary hover:bg-white/5 transition-all text-sm font-medium text-left rounded-t-2xl">
              <Shield className="w-5 h-5 shrink-0" />
              Privacy & Security
              <ChevronRight className="w-4 h-4 ml-auto" />
            </button>
            <button className="w-full flex items-center gap-4 p-5 text-secondary hover:text-orange-400 hover:bg-orange-500/5 transition-all text-sm font-medium text-left">
              <LogOut className="w-5 h-5 shrink-0" />
              Log Out
            </button>
            <button className="w-full flex items-center gap-4 p-5 text-secondary hover:text-red-400 hover:bg-red-500/5 transition-all text-sm font-medium text-left rounded-b-2xl">
              <Trash2 className="w-5 h-5 shrink-0" />
              Delete Account
            </button>
          </div>
        </section>
      </div>
    </motion.div>);

}