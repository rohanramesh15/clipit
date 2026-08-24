import { LoaderCircle } from 'lucide-react';

interface LoadingAnimationProps {
  className?: string;
  label?: string;
}

/** Shared neutral loader for asynchronous actions and page states. */
export function LoadingAnimation({ className = 'h-8 w-8', label }: LoadingAnimationProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <LoaderCircle className="h-full w-full animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
