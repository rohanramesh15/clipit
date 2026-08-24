import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

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
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      variant="ghost"
      size="icon"
      className={`text-secondary ${className}`}
    >
      <NavigationIcon direction={direction} />
    </Button>
  );
}
