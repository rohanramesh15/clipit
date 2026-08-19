import { useEffect, useRef, useState } from 'react';

/**
 * Hides a fixed header while the page scrolls down and reveals it again the
 * moment the user scrolls up. Small jitters are ignored, and the header is
 * always visible near the top of the page.
 */
export function useHideOnScroll(threshold = 8, revealAbove = 72): boolean {
  const [isHidden, setIsHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastY.current;

      if (Math.abs(delta) < threshold) return;

      if (currentY < revealAbove) {
        setIsHidden(false);
      } else {
        setIsHidden(delta > 0);
      }

      lastY.current = currentY;
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold, revealAbove]);

  return isHidden;
}
