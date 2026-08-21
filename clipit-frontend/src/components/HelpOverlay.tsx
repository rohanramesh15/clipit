import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useHelp } from '../context/HelpContext';
import { useDialogFocus } from '../hooks/useDialogFocus';

export interface HelpTip {
  id: string;
  text: string;
  // Target element ID for dynamic positioning
  targetId?: string;
  // Preferred position relative to target
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  offset?: { x?: number; y?: number };
}

interface HelpOverlayProps {
  tips: HelpTip[];
}

interface TipPosition {
  top: number;
  left: number;
  visible: boolean;
  actualPosition: string; // The position that was actually used after adjustments
}

const TIP_WIDTH = 250;
const TIP_HEIGHT = 80;
const TIP_MARGIN = 16;
const TIP_ARROW_SIZE = 8;

// Legacy fixed position classes
const legacyPositionClasses: Record<string, string> = {
  'top-left': 'top-24 left-8',
  'top-center': 'top-24 left-1/2 -translate-x-1/2',
  'top-right': 'top-24 right-8',
  'center-left': 'top-1/2 left-8 -translate-y-1/2',
  'center-right': 'top-1/2 right-8 -translate-y-1/2',
  'bottom-left': 'bottom-24 left-8',
  'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-24 right-24',
};

const legacyArrowClasses: Record<string, string> = {
  'top-left': 'top-full left-4 border-t-accent',
  'top-center': 'top-full left-1/2 -translate-x-1/2 border-t-accent',
  'top-right': 'top-full right-4 border-t-accent',
  'center-left': 'top-1/2 -translate-y-1/2 left-full border-l-accent',
  'center-right': 'top-1/2 -translate-y-1/2 right-full border-r-accent',
  'bottom-left': 'bottom-full left-4 border-b-accent',
  'bottom-center': 'bottom-full left-1/2 -translate-x-1/2 border-b-accent',
  'bottom-right': 'bottom-full right-4 border-b-accent',
};

// Legacy tooltip (fixed position)
function LegacyHelpTooltip({ tip, index }: { tip: HelpTip; index: number }) {
  const pos = tip.position || 'top-center';
  const style: React.CSSProperties = {};
  if (tip.offset?.x) style.marginLeft = tip.offset.x;
  if (tip.offset?.y) style.marginTop = tip.offset.y;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.1, duration: 0.2 }}
      className={`fixed ${legacyPositionClasses[pos]} z-[60] max-w-xs`}
      style={style}
    >
      <div className="relative bg-accent text-app px-4 py-3 rounded-lg shadow-xl">
        <p className="text-sm font-medium">{tip.text}</p>
        <div
          className={`absolute w-0 h-0 border-8 border-transparent ${legacyArrowClasses[pos]}`}
        />
      </div>
    </motion.div>
  );
}

// Get arrow styles based on actual position used
function getArrowStyles(position: string): string {
  const styles: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-accent border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-accent border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-accent border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-accent border-t-transparent border-b-transparent border-l-transparent',
  };
  return styles[position] || styles.top;
}

// Dynamic tooltip (follows element)
function DynamicHelpTooltip({
  tip,
  index,
  position
}: {
  tip: HelpTip;
  index: number;
  position: TipPosition;
}) {
  if (!position.visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.1, duration: 0.2 }}
      className="fixed z-[60] pointer-events-none"
      style={{
        top: position.top,
        left: position.left,
        maxWidth: TIP_WIDTH,
      }}
    >
      <div className="relative bg-accent text-app px-4 py-3 rounded-lg shadow-xl">
        <p className="text-sm font-medium">{tip.text}</p>
        <div
          className={`absolute w-0 h-0 border-8 border-transparent ${getArrowStyles(position.actualPosition)}`}
        />
      </div>
    </motion.div>
  );
}

export function HelpOverlay({ tips }: HelpOverlayProps) {
  const { isHelpMode, closeHelpMode } = useHelp();
  const dialogRef = useDialogFocus(isHelpMode, closeHelpMode);
  const [positions, setPositions] = useState<Record<string, TipPosition>>({});
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibilityRef = useRef<Record<string, boolean>>({});
  const occupiedAreasRef = useRef<Array<{ top: number; bottom: number; left: number; right: number }>>([]);

  // Separate tips into legacy (no targetId) and dynamic (has targetId)
  const legacyTips = tips.filter(tip => !tip.targetId);
  const dynamicTips = tips.filter(tip => tip.targetId);

  // Check if a rectangle overlaps with any occupied area
  const checkOverlap = useCallback((top: number, left: number, width: number, height: number): boolean => {
    const newArea = {
      top,
      bottom: top + height,
      left,
      right: left + width,
    };

    return occupiedAreasRef.current.some(area => {
      const horizontalOverlap = newArea.left < area.right && newArea.right > area.left;
      const verticalOverlap = newArea.top < area.bottom && newArea.bottom > area.top;
      return horizontalOverlap && verticalOverlap;
    });
  }, []);

  // Calculate position for a dynamic tip based on its target element
  const calculatePosition = useCallback((
    targetId: string,
    preferredPosition: string,
    tipIndex: number
  ): TipPosition => {
    const element = document.getElementById(targetId);
    if (!element) {
      return { top: 0, left: 0, visible: false, actualPosition: preferredPosition };
    }

    const rect = element.getBoundingClientRect();
    const isVisible = visibilityRef.current[targetId] ?? true;

    // Check if element is in viewport
    const inViewport = rect.top < windowSize.height && rect.bottom > 0;

    if (!inViewport || !isVisible) {
      return { top: 0, left: 0, visible: false, actualPosition: preferredPosition };
    }

    // Try positions in order of preference
    const positionOrder = getPositionOrder(preferredPosition);

    for (const position of positionOrder) {
      const coords = getPositionCoordinates(rect, position, windowSize);

      if (coords && !checkOverlap(coords.top, coords.left, TIP_WIDTH, TIP_HEIGHT)) {
        // Mark this area as occupied
        occupiedAreasRef.current.push({
          top: coords.top,
          bottom: coords.top + TIP_HEIGHT,
          left: coords.left,
          right: coords.left + TIP_WIDTH,
        });

        return {
          top: coords.top,
          left: coords.left,
          visible: true,
          actualPosition: position,
        };
      }
    }

    // Fallback: place it somewhere visible even if overlapping
    const fallbackCoords = getPositionCoordinates(rect, preferredPosition, windowSize);
    if (fallbackCoords) {
      return {
        top: fallbackCoords.top,
        left: fallbackCoords.left,
        visible: true,
        actualPosition: preferredPosition,
      };
    }

    return { top: 0, left: 0, visible: false, actualPosition: preferredPosition };
  }, [windowSize, checkOverlap]);

  // Update all dynamic positions
  const updatePositions = useCallback(() => {
    // Reset occupied areas
    occupiedAreasRef.current = [];

    const newPositions: Record<string, TipPosition> = {};
    dynamicTips.forEach((tip, index) => {
      if (tip.targetId) {
        newPositions[tip.id] = calculatePosition(
          tip.targetId,
          tip.position || 'right',
          index
        );
      }
    });
    setPositions(newPositions);
  }, [dynamicTips, calculatePosition]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set up intersection observer and scroll listener for dynamic tips
  useEffect(() => {
    if (!isHelpMode || dynamicTips.length === 0) return;

    // Initialize visibility
    dynamicTips.forEach(tip => {
      if (tip.targetId) {
        visibilityRef.current[tip.targetId] = true;
      }
    });

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const targetId = entry.target.id;
          visibilityRef.current[targetId] = entry.isIntersecting;
        });
        updatePositions();
      },
      { threshold: 0.1 }
    );

    // Observe all target elements
    dynamicTips.forEach(tip => {
      if (tip.targetId) {
        const element = document.getElementById(tip.targetId);
        if (element && observerRef.current) {
          observerRef.current.observe(element);
        }
      }
    });

    // Initial position calculation
    updatePositions();

    // Update on scroll
    const handleScroll = () => updatePositions();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isHelpMode, dynamicTips, updatePositions]);

  // Recalculate positions when window size changes
  useEffect(() => {
    if (isHelpMode) {
      updatePositions();
    }
  }, [windowSize, isHelpMode, updatePositions]);

  return (
    <AnimatePresence>
      {isHelpMode && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[55] backdrop-blur-[2px]"
            onClick={closeHelpMode}
          />

          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Help tips"
            tabIndex={-1}
            className="pointer-events-none fixed inset-0 z-[60]"
          >
            <button
              type="button"
              onClick={closeHelpMode}
              className="pointer-events-auto absolute right-5 top-5 rounded-lg bg-app p-2 text-primary shadow-lg"
              aria-label="Close help tips"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {legacyTips.map((tip, index) => (
              <LegacyHelpTooltip key={tip.id} tip={tip} index={index} />
            ))}

            {dynamicTips.map((tip, index) => (
              <DynamicHelpTooltip
                key={tip.id}
                tip={tip}
                index={legacyTips.length + index}
                position={positions[tip.id] || { top: 0, left: 0, visible: false, actualPosition: tip.position || 'right' }}
              />
            ))}
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// Get position order based on preferred position (try preferred first, then alternatives)
function getPositionOrder(preferred: string): string[] {
  const allPositions = ['right', 'left', 'bottom', 'top'];
  const index = allPositions.indexOf(preferred);
  if (index === -1) return allPositions;

  // Put preferred first, then others
  return [preferred, ...allPositions.filter(p => p !== preferred)];
}

// Calculate actual coordinates for a position
function getPositionCoordinates(
  rect: DOMRect,
  position: string,
  windowSize: { width: number; height: number }
): { top: number; left: number } | null {
  let top = 0;
  let left = 0;

  switch (position) {
    case 'top':
      top = rect.top - TIP_HEIGHT - TIP_MARGIN;
      left = rect.left + rect.width / 2 - TIP_WIDTH / 2;
      break;
    case 'bottom':
      top = rect.bottom + TIP_MARGIN;
      left = rect.left + rect.width / 2 - TIP_WIDTH / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - TIP_HEIGHT / 2;
      left = rect.left - TIP_WIDTH - TIP_MARGIN;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - TIP_HEIGHT / 2;
      left = rect.right + TIP_MARGIN;
      break;
    default:
      return null;
  }

  // Check if position is within viewport bounds
  const isWithinBounds =
    top >= TIP_MARGIN &&
    top + TIP_HEIGHT <= windowSize.height - TIP_MARGIN &&
    left >= TIP_MARGIN &&
    left + TIP_WIDTH <= windowSize.width - TIP_MARGIN;

  if (!isWithinBounds) {
    // Try to clamp to viewport
    top = Math.max(TIP_MARGIN, Math.min(top, windowSize.height - TIP_HEIGHT - TIP_MARGIN));
    left = Math.max(TIP_MARGIN, Math.min(left, windowSize.width - TIP_WIDTH - TIP_MARGIN));

    // If still out of bounds significantly, return null to try another position
    if (
      (position === 'left' && rect.left < TIP_WIDTH + TIP_MARGIN * 2) ||
      (position === 'right' && rect.right + TIP_WIDTH + TIP_MARGIN > windowSize.width) ||
      (position === 'top' && rect.top < TIP_HEIGHT + TIP_MARGIN * 2) ||
      (position === 'bottom' && rect.bottom + TIP_HEIGHT + TIP_MARGIN > windowSize.height)
    ) {
      return null;
    }
  }

  return { top, left };
}
