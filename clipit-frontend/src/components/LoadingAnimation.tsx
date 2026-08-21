import loadingAnimation from '../assets/video-remove-background-1787266488808.webm';

interface LoadingAnimationProps {
  className?: string;
  label?: string;
}

/** Shared visual loader. The supplied animation replaces CSS spinners and shimmers. */
export function LoadingAnimation({ className = 'h-8 w-8', label }: LoadingAnimationProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        src={loadingAnimation}
        className="h-full w-full object-contain motion-reduce:hidden"
        aria-hidden="true"
      />
      <span className="hidden text-current motion-reduce:block" aria-hidden="true">…</span>
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
