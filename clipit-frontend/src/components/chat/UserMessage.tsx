import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon } from 'lucide-react';
import type { ChatMessage } from '../../types/chat';

interface UserMessageProps {
  message: ChatMessage;
  animateIn: boolean;
  /** Target-word lemmas this turn used, if any. */
  usedTargets: string[];
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function UserMessage({ message, animateIn, usedTargets }: UserMessageProps) {
  return (
    <motion.article
      initial={animateIn ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
      className="flex flex-col items-end gap-1.5 pl-12"
    >
      <p className="max-w-[85%] text-right text-lead text-secondary">{message.text}</p>
      {usedTargets.length > 0 && (
        <span className="flex items-center gap-1 text-meta text-accent">
          <CheckIcon className="size-3.5" aria-hidden="true" /> {usedTargets.join(', ')}
        </span>
      )}
    </motion.article>
  );
}
