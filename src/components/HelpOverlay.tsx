import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHelp } from '../context/HelpContext';

export interface HelpTip {
  id: string;
  text: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  offset?: { x?: number; y?: number };
}

interface HelpOverlayProps {
  tips: HelpTip[];
}

const positionClasses: Record<HelpTip['position'], string> = {
  'top-left': 'top-24 left-8',
  'top-center': 'top-24 left-1/2 -translate-x-1/2',
  'top-right': 'top-24 right-8',
  'center-left': 'top-1/2 left-8 -translate-y-1/2',
  'center-right': 'top-1/2 right-8 -translate-y-1/2',
  'bottom-left': 'bottom-24 left-8',
  'bottom-center': 'bottom-24 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-24 right-24',
};

const arrowClasses: Record<HelpTip['position'], string> = {
  'top-left': 'top-full left-4 border-t-accent',
  'top-center': 'top-full left-1/2 -translate-x-1/2 border-t-accent',
  'top-right': 'top-full right-4 border-t-accent',
  'center-left': 'top-1/2 -translate-y-1/2 left-full border-l-accent',
  'center-right': 'top-1/2 -translate-y-1/2 right-full border-r-accent',
  'bottom-left': 'bottom-full left-4 border-b-accent',
  'bottom-center': 'bottom-full left-1/2 -translate-x-1/2 border-b-accent',
  'bottom-right': 'bottom-full right-4 border-b-accent',
};

function HelpTooltip({ tip, index }: { tip: HelpTip; index: number }) {
  const style: React.CSSProperties = {};
  if (tip.offset?.x) style.marginLeft = tip.offset.x;
  if (tip.offset?.y) style.marginTop = tip.offset.y;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.1, duration: 0.2 }}
      className={`fixed ${positionClasses[tip.position]} z-[60] max-w-xs`}
      style={style}
    >
      <div className="relative bg-accent text-app px-4 py-3 rounded-lg shadow-xl">
        <p className="text-sm font-medium">{tip.text}</p>
        {/* Arrow */}
        <div
          className={`absolute w-0 h-0 border-8 border-transparent ${arrowClasses[tip.position]}`}
        />
      </div>
    </motion.div>
  );
}

export function HelpOverlay({ tips }: HelpOverlayProps) {
  const { isHelpMode, closeHelpMode } = useHelp();

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

          {/* Tips */}
          {tips.map((tip, index) => (
            <HelpTooltip key={tip.id} tip={tip} index={index} />
          ))}
        </>
      )}
    </AnimatePresence>
  );
}
