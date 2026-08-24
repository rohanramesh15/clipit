import React from 'react';
import { LoadingAnimation } from '../LoadingAnimation';
import { Button } from '../ui/button';

interface PrimaryButtonProps {
  children: React.ReactNode;
  type?: 'button' | 'submit';
  isLoading?: boolean;
  onClick?: () => void;
}

export function PrimaryButton({ children, type = 'submit', isLoading = false, onClick }: PrimaryButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={isLoading}
      className="flex h-11 w-full font-bold"
    >
      {isLoading ? <LoadingAnimation className="h-4 w-4" /> : children}
    </Button>
  );
}
