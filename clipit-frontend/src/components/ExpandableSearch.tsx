import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SearchIcon } from 'lucide-react';

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

// A single continuous shape morphs between the two states (rather than
// swapping a button for an input), so the icon slides into place and the
// input text fades in as the bar widens instead of hard cross-fading.
const EXPAND_TRANSITION = { duration: 0.28, ease: [0.23, 1, 0.32, 1] } as const;

/** A compact search trigger that expands toward the left, beside its sibling controls. */
export function ExpandableSearch({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
}: ExpandableSearchProps) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = expanded || value.trim().length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    const closeWhenEmpty = (event: PointerEvent) => {
      if (value.trim() || rootRef.current?.contains(event.target as Node)) return;
      setExpanded(false);
    };
    document.addEventListener('pointerdown', closeWhenEmpty);
    return () => document.removeEventListener('pointerdown', closeWhenEmpty);
  }, [value]);

  return (
    <div ref={rootRef} className="flex min-w-10 flex-1 justify-end">
      <motion.div
        className="relative h-10 max-w-full overflow-hidden rounded-xl border border-subtle bg-app"
        animate={{ width: isOpen ? 336 : 40 }}
        transition={EXPAND_TRANSITION}
      >
        <motion.span
          className="pointer-events-none absolute top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-muted"
          animate={{ left: isOpen ? 14 : 20, x: isOpen ? '0%' : '-50%' }}
          transition={EXPAND_TRANSITION}
        >
          <SearchIcon className="h-4 w-4" aria-hidden="true" />
        </motion.span>
        <label className="block h-full w-full cursor-pointer">
          <span className="sr-only">{label}</span>
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder={placeholder}
            className="h-full w-full bg-transparent pl-9 pr-3 text-body-sm text-muted outline-none transition-opacity duration-200 ease-out placeholder:text-muted/70 focus-visible:!outline-none"
            style={{ opacity: isOpen ? 1 : 0 }}
          />
        </label>
      </motion.div>
    </div>
  );
}
