export const SPRING_PREMIUM = { type: "spring", stiffness: 700, damping: 37, mass: 0.5 } as const;

export const SPRING_FLASH = { type: "spring", stiffness: 900, damping: 50, mass: 0.1 } as const;

export const VARIANTS_BREATHE = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1 },
} as const;

export const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 30 } as const;

export const SLIDE_FROM_BOTTOM = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
} as const;

export const SPRING_GENTLE = { type: "spring", stiffness: 100, damping: 20 } as const;
