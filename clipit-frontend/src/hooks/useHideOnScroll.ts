import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Hides a fixed header while the page scrolls down and reveals it again the
 * moment the user scrolls up. Small jitters are ignored, and the header is
 * always visible near the top of the page.
 */
export function useHideOnScroll(threshold = 8, revealAbove = 72, resetKey?: unknown): boolean {
  const [isHidden, setIsHidden] = useState(false);
  const lastY = useRef(0);
  const lastHeight = useRef(0);

  // Page changes are not user scrolling. Reset before the incoming page paints
  // so a header hidden on the previous screen never carries into the next one.
  useLayoutEffect(() => {
    lastY.current = window.scrollY;
    lastHeight.current = window.innerHeight;
    setIsHidden(false);
  }, [resetKey]);

  useEffect(() => {
    lastY.current = window.scrollY;
    lastHeight.current = window.innerHeight;

    function handleScroll() {
      const currentY = window.scrollY;
      const currentHeight = window.innerHeight;

      // Mobile browsers resize the viewport as their address bar collapses
      // or expands while a page settles in, which fires a scroll event with
      // no real user scrolling behind it — that resize alone was enough to
      // hide the header on phones right after navigating. Treat any
      // viewport-height change as noise rather than a scroll direction.
      if (currentHeight !== lastHeight.current) {
        lastHeight.current = currentHeight;
        lastY.current = currentY;
        return;
      }

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
