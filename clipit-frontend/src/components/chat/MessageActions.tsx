import React from 'react';
import { Tooltip } from '../Tooltip';

interface ActionButtonProps {
  /** One or two words — it doubles as the tooltip. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}

export function ActionButton({ label, onClick, disabled, active, children }: ActionButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`grid size-8 place-items-center rounded-lg hover:bg-surface-hover disabled:opacity-40 ${
          active ? 'bg-accent-soft text-accent' : 'text-muted hover:text-primary'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
