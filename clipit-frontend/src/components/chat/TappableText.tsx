import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookmarkPlusIcon, CheckIcon } from 'lucide-react';
import { translate } from '../../services/converseV2';
import type { SavedWord } from '../../types/chat';

interface TappableTextProps {
  text: string;
  /** Text currently visible while a parent-controlled transition is running. */
  displayText?: string;
  language: string;
  /** Fade words in as they arrive during a live streamed response. */
  animateWords?: boolean;
  /** Target-word lemmas for this session — matched words render bold/accent. */
  targets?: string[];
  savedWords: SavedWord[];
  onSaveWord: (word: SavedWord) => void;
}

function stripPunct(word: string): string {
  return word.replace(/^[¿?¡!.,;:"'()«»…]+|[¿?¡!.,;:"'()«»…]+$/gu, '');
}

export function TappableText({ text, displayText, language, animateWords = false, targets = [], savedWords, onSaveWord }: TappableTextProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [glosses, setGlosses] = useState<Record<number, { text: string; loading: boolean }>>({});
  const containerRef = useRef<HTMLSpanElement>(null);
  const targetSet = new Set(targets.map((t) => t.toLowerCase()));

  useEffect(() => {
    if (openIndex === null) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpenIndex(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenIndex(null);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openIndex]);

  const tokens = (displayText ?? text).split(/(\s+)/);

  function openWord(index: number, word: string) {
    setOpenIndex(index);
    if (glosses[index]) return;
    setGlosses((prev) => ({ ...prev, [index]: { text: '', loading: true } }));
    translate(word, language)
      .then((t) => setGlosses((prev) => ({ ...prev, [index]: { text: t, loading: false } })))
      .catch(() => setGlosses((prev) => ({ ...prev, [index]: { text: '—', loading: false } })));
  }

  return (
    <span ref={containerRef}>
      {tokens.map((token, index) => {
        const word = stripPunct(token);
        if (!word) return <span key={index}>{token}</span>;

        const isOpen = openIndex === index;
        const isTarget = targetSet.has(word.toLowerCase());
        const isSaved = savedWords.some((w) => w.lemma.toLowerCase() === word.toLowerCase());
        const gloss = glosses[index];

        return (
          <motion.span
            key={index}
            initial={animateWords ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative inline-block"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => (isOpen ? setOpenIndex(null) : openWord(index, word))}
              className={`rounded-md px-[1px] decoration-1 underline-offset-[6px] hover:underline hover:decoration-accent ${
                isOpen ? 'bg-accent-soft text-accent underline decoration-accent' : ''
              } ${isTarget && !isOpen ? 'font-semibold text-accent' : ''}`}
            >
              {token}
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.span
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute bottom-full left-1/2 z-30 mb-2 block w-max max-w-[16rem] -translate-x-1/2 rounded-xl border border-subtle bg-app p-3 text-left shadow-pop"
                >
                  <span className="block text-body-sm font-semibold text-primary">{word}</span>
                  <span className="mt-0.5 block text-body-sm text-secondary">
                    {gloss?.loading ? 'Translating…' : (gloss?.text || '—')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSaveWord({ lemma: word, gloss: gloss?.text || '' })}
                    disabled={isSaved || !gloss || gloss.loading}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface-hover px-2 py-1 text-meta font-medium text-secondary hover:text-primary disabled:opacity-70"
                  >
                    {isSaved ? (
                      <CheckIcon className="size-3.5 text-accent" aria-hidden="true" />
                    ) : (
                      <BookmarkPlusIcon className="size-3.5" aria-hidden="true" />
                    )}
                    {isSaved ? 'Saved' : 'Save word'}
                  </button>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
        );
      })}
    </span>
  );
}
