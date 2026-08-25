import React from 'react';

interface TooltipProps {
  /** One or two words, never a sentence. */
  label: string;
  placement?: 'top' | 'bottom';
  children: React.ReactNode;
}

/** Matches the app's help tooltips: accent fill, app-coloured text, rounded-lg. */
export function Tooltip({ label, placement = 'top', children }: TooltipProps) {
  const position = placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        /* Hover, or keyboard focus only — a mouse click must not leave it stuck. */
        className={`pointer-events-none invisible absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg bg-accent-hover px-2.5 py-1.5 text-meta font-medium text-app opacity-0 shadow-xl transition-opacity duration-150 ease-swift group-hover/tip:visible group-hover/tip:opacity-100 group-[:has(:focus-visible)]/tip:visible group-[:has(:focus-visible)]/tip:opacity-100 ${position}`}
      >
        {label}
      </span>
    </span>
  );
}
