import { useState } from 'react';
import type { AuthUser } from '../context/AuthContext';

interface AvatarProps {
  user: AuthUser | null;
  size?: number;        // px — applied as width + height
  className?: string;   // extra classes (e.g. ring/border overrides)
  textClassName?: string; // for the initials font-size override
}

/**
 * Compute initials from a name like "John Doe" → "JD", "Madonna" → "M".
 * Falls back to the first letter of the email, or '?' if nothing is available.
 */
export function getInitials(user: AuthUser | null): string {
  if (!user) return '?';
  const name = (user.full_name || '').trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (user.email) return user.email[0].toUpperCase();
  return '?';
}

/**
 * Display the user's Google profile picture if available, otherwise
 * fall back to a gradient circle with their initials.
 */
export function Avatar({
  user,
  size = 40,
  className = '',
  textClassName = '',
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = !!user?.profile_picture && !imgFailed;
  const initials = getInitials(user);

  if (showImg) {
    return (
      <img
        src={user!.profile_picture!}
        alt={user?.full_name || user?.email || 'Profile'}
        onError={() => setImgFailed(true)}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gradient-to-tr from-accent to-orange-500 flex items-center justify-center text-app font-bold shrink-0 select-none ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size * 0.38)) }}>
      <span className={textClassName}>{initials}</span>
    </div>
  );
}
