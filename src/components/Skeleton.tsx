import React from 'react';

/**
 * Shimmering placeholder box used for loading states across the app.
 * Shape it with Tailwind sizing/radius classes (e.g. `h-14 w-full rounded-2xl`)
 * so the skeleton mirrors the real UI box it stands in for.
 */
export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}
