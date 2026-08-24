import React from 'react';
import { HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHelp } from '../context/HelpContext';

export function HelpButton() {
  const { isHelpMode, toggleHelpMode } = useHelp();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
      <motion.button
        onClick={toggleHelpMode}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
          isHelpMode
            ? 'bg-accent text-on-accent'
            : 'bg-card text-secondary hover:text-primary hover:bg-card-hover'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title={isHelpMode ? 'Close help' : 'Show help tips'}
      >
        <AnimatePresence mode="wait">
          {isHelpMode ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={22} />
            </motion.div>
          ) : (
            <motion.div
              key="help"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <HelpCircle size={22} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
