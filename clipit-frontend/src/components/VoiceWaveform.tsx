import { motion } from 'framer-motion';

interface VoiceWaveformProps {
  /** Relative bar heights (0-1) that give each voice its own idle shape. */
  signature: number[];
  isPlaying: boolean;
  /** Bar container height in px. */
  height?: number;
  barWidth?: number;
  className?: string;
}

export function VoiceWaveform({
  signature,
  isPlaying,
  height = 20,
  barWidth = 3,
  className = '',
}: VoiceWaveformProps) {
  return (
    <div aria-hidden="true" className={`flex items-center gap-[3px] ${className}`} style={{ height }}>
      {signature.map((level, index) => {
        const idle = Math.max(0.18, level * 0.7);
        return (
          <motion.span
            key={index}
            className="block rounded-full bg-current"
            style={{ width: barWidth, originY: 0.5 }}
            initial={false}
            animate={
              isPlaying
                ? { height: [idle * height, level * height, idle * height * 0.8, level * height * 0.9] }
                : { height: idle * height }
            }
            transition={
              isPlaying
                ? { duration: 0.72 + index * 0.06, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
                : { duration: 0.2, ease: [0.23, 1, 0.32, 1] }
            }
          />
        );
      })}
    </div>
  );
}
