import { ChevronLeft, ChevronRight } from 'lucide-react';

type Direction = 'back' | 'forward';

interface NavigationIconProps {
  direction: Direction;
  className?: string;
}

/** Shared chevron treatment for directional app navigation. */
export function NavigationIcon({ direction, className = 'h-5 w-5' }: NavigationIconProps) {
  const Icon = direction === 'back' ? ChevronLeft : ChevronRight;
  return <Icon className={className} aria-hidden="true" />;
}

interface NavigationIconButtonProps extends NavigationIconProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function NavigationIconButton({ direction, label, onClick, disabled, className = '' }: NavigationIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex items-center rounded-xl p-2 text-secondary transition-colors duration-150 ease-swift hover:text-primary disabled:opacity-40 ${className}`}
    >
      <NavigationIcon direction={direction} />
    </button>
  );
}
