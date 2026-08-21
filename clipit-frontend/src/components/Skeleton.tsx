import React from 'react';

/**
 * A single, softly pulsing placeholder for a major page region. Keep callers
 * coarse: one card, list, chart, or panel rather than simulated text lines.
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
