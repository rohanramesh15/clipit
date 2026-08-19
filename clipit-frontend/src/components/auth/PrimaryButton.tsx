import React from 'react';
import { Loader2 } from 'lucide-react';

interface PrimaryButtonProps {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  isLoading?: boolean;
  onClick?: () => void;
}

export function PrimaryButton({ children, type = 'submit', isLoading = false, onClick }: PrimaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-body-sm font-bold text-[var(--on-accent)] transition-colors duration-150 ease-swift hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : children}
    </button>
  );
}
