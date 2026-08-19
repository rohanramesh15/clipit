import React from 'react';
import { AlertCircle } from 'lucide-react';

export function FormError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-error/10 px-3.5 py-2.5 text-body-sm text-[#b91c1c]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
