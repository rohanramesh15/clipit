import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SearchIcon } from 'lucide-react';

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

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
        className="max-w-full overflow-hidden"
        animate={{ width: isOpen ? 336 : 40 }}
        transition={{ type: 'spring', stiffness: 420, damping: 24, mass: 0.7 }}
      >
        {isOpen ? (
          <label className="relative block w-full">
            <span className="sr-only">{label}</span>
            <SearchIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder={placeholder}
              className="h-10 w-full rounded-xl border search-bar-border bg-app pl-9 pr-3 text-body-sm text-muted placeholder:text-muted/70 outline-none focus-visible:!outline-none"
            />
          </label>
        ) : (
          <button
            type="button"
            aria-label={label}
            aria-expanded={false}
            onClick={() => setExpanded(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-subtle bg-app text-muted"
          >
            <SearchIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </motion.div>
    </div>
  );
}
