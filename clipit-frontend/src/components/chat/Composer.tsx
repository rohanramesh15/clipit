import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpIcon, MicIcon } from 'lucide-react';
import { LoadingAnimation } from '../LoadingAnimation';
import { Tooltip } from '../Tooltip';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  thinking: boolean;
  /** The session isn't ready to accept a message yet (still loading). */
  disabled?: boolean;
  placeholder: string;
  /** Return to the voice controls. */
  onClose: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;

export function Composer({ value, onChange, onSend, thinking, disabled, placeholder, onClose }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function submit() {
    if (!value.trim() || thinking || disabled) return;
    onSend(value);
    onChange('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleInput(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(event.target.value);
    const el = event.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-subtle bg-surface p-2 transition-colors duration-150 ease-swift focus-within:bg-surface-hover"
    >
      <label htmlFor="composer" className="sr-only">
        Write your reply
      </label>
      <textarea
        id="composer"
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={handleInput}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full resize-none bg-transparent px-4 pb-1 pt-3 text-body text-primary placeholder:text-muted outline-none focus-visible:outline-none disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-subtle px-3 py-1.5 text-body-sm font-medium text-secondary transition-colors duration-150 ease-swift hover:border-medium hover:text-primary"
        >
          <MicIcon className="size-4 text-accent" aria-hidden="true" />
          Back to voice
        </button>

        <div className="flex items-center gap-3">
          {value.trim() && (
            <span className="hidden text-meta text-muted sm:inline">Enter to send</span>
          )}
          <Tooltip label="Send">
            <button
              type="submit"
              disabled={!value.trim() || thinking || disabled}
              aria-label="Send message"
              className="grid size-10 place-items-center rounded-xl bg-accent text-on-accent transition-colors duration-150 ease-swift hover:bg-accent-hover disabled:bg-surface-hover disabled:text-muted"
            >
              {thinking ? <LoadingAnimation className="h-4 w-4" /> : <ArrowUpIcon className="size-5" aria-hidden="true" />}
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.form>
  );
}
