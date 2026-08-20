import React from 'react';

/**
 * Static placeholder box used to preserve layout while the shared loader plays.
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
