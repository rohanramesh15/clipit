export const motionEase = [0.23, 1, 0.32, 1] as const;

export const motionTiming = {
  fast: { duration: 0.16, ease: motionEase },
  base: { duration: 0.22, ease: motionEase },
  page: { duration: 0.32, ease: motionEase },
} as const;
