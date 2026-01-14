// Premium spring physics for fluid UI interactions
// Critically damped to avoid "cheap" oscillation while maintaining responsiveness
// Tuned for "Efficiency Tool" feel: High stiffness, low mass for instant response
export const SPRING_PREMIUM = { type: "spring", stiffness: 800, damping: 40, mass: 0.2 } as const;
export const SPRING_FLASH = { type: "spring", stiffness: 900, damping: 50, mass: 0.1 } as const;

// Micro-scale breathing effect for entry animations
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
