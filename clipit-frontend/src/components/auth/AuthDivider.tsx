import React from 'react';

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3" role="presentation">
      <span className="h-px flex-1 bg-[var(--border-medium)]" />
      <span className="text-meta text-muted">{label}</span>
      <span className="h-px flex-1 bg-[var(--border-medium)]" />
    </div>
  );
}
