import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <Button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Hide password' : 'Show password'}
      variant="ghost"
      size="icon"
      className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-muted"
    >
      {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
