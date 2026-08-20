import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Info } from 'lucide-react';

const EXTENSION_URL = 'https://chromewebstore.google.com/detail/clipit/pcnnmkbacmcfldjgmaljkjdnfijkkokn';

interface ExtensionInfoProps {
  languageName: string;
}

export function ExtensionInfo({ languageName }: ExtensionInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const steps = [
    { title: 'Get the extension', detail: 'One click, then it sits in your browser.' },
    { title: `Watch in ${languageName}`, detail: 'Words get clipped as you watch.' },
    { title: 'Start practicing', detail: 'Flash cards, AI chat and mad libs.' },
  ];

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="How ClipIt works"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 ease-swift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          isOpen ? 'bg-blush text-accent' : 'text-muted hover:bg-blush hover:text-accent'
        }`}
      >
        <Info className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="How ClipIt works"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-40 mt-3 w-[19.5rem] rounded-xl border border-subtle bg-surface text-left shadow-[0_14px_36px_rgba(76,35,35,0.14)]"
          >
            <span
              aria-hidden="true"
              className="absolute -top-[6px] right-3 h-3 w-3 rotate-45 rounded-[2px] border-l border-t border-subtle bg-surface"
            />

            <div className="px-5 pt-5">
              <p className="font-heading text-body font-semibold text-primary">Three steps</p>
              <p className="mt-0.5 text-body-sm text-muted">From watching to practicing.</p>
            </div>

            <ol className="mt-4 space-y-4 px-5">
              {steps.map((step, index) => (
                <li key={step.title} className="min-w-0">
                  <p className="text-body-sm font-semibold text-primary">
                    <span className="mr-1.5 text-muted">{index + 1}</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-body-sm text-secondary">{step.detail}</p>
                </li>
              ))}
            </ol>

            <div className="mt-5 border-t border-subtle p-4">
              <a
                href={EXTENSION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-body-sm font-semibold text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover"
              >
                Get the extension
                <ArrowUpRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
