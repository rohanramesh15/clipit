import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  Icon?: LucideIcon;
  description?: string;
  /** Optional ghost preview of the content that will appear here. */
  visual?: React.ReactNode;
  children?: React.ReactNode;
}

export function EmptyState({ title, Icon, description, visual, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-subtle bg-surface px-6 py-12 text-center">
      {visual ? (
        <div className="w-full max-w-xl" aria-hidden="true">
          {visual}
        </div>
      ) : (
        Icon && (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blush text-accent" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
        )
      )}

      <h3 className="mt-6 font-heading text-card-title font-medium text-primary">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-body-sm text-secondary">{description}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}
