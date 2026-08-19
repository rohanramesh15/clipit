import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface AuthFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  icon: LucideIcon;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  /** Rendered at the right edge of the input (e.g. a show-password toggle). */
  trailing?: React.ReactNode;
  /** Rendered inline with the label, right-aligned (e.g. "Forgot password?"). */
  labelAction?: React.ReactNode;
  hint?: string;
}

export function AuthField({
  id,
  label,
  type,
  value,
  onChange,
  icon: Icon,
  placeholder,
  autoComplete,
  required = true,
  minLength,
  trailing,
  labelAction,
  hint,
}: AuthFieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-meta font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          className={`w-full rounded-xl border border-medium bg-app py-2.5 pl-10 text-body-sm text-primary transition-colors duration-150 ease-swift placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${trailing ? 'pr-10' : 'pr-3.5'}`}
        />
        {trailing}
      </div>
      {hint && <p className="mt-1.5 text-meta text-muted">{hint}</p>}
    </div>
  );
}
