import React from 'react';

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

/** One labelled setting: copy on the left, control on the right at desktop width. */
export function SettingRow({ label, description, htmlFor, children }: SettingRowProps) {
  const Label = htmlFor ? 'label' : 'span';

  return (
    <div className="flex flex-col gap-4 border-b border-subtle py-6 last:border-b-0 md:flex-row md:items-start md:justify-between md:gap-10">
      <div className="max-w-md">
        <Label htmlFor={htmlFor} className="block text-body font-semibold text-primary">
          {label}
        </Label>
        {description && <p className="mt-1 text-body-sm text-secondary">{description}</p>}
      </div>
      <div className="shrink-0 md:pt-0.5">{children}</div>
    </div>
  );
}
