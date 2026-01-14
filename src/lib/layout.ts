/**
 * layout.ts
 * Centralized constants for NekoTick visual layout calculations.
 * Ensures strict alignment between CSS styles and JS spacing logic.
 */

export const PHI = 1.618033988749895;

// Layout Dimensions
export const CONTENT_MAX_WIDTH = 900;
export const PADDING_DESKTOP = 96; // px-24 * 4
export const PADDING_MOBILE = 48; // px-12 * 4

// Tailwind Class Construction
// This ensures that the CSS class matches the logic used in calculations.
export const EDITOR_LAYOUT_CLASS = `w-full max-w-[${CONTENT_MAX_WIDTH}px] px-12 md:px-24 shrink-0`;

// Safety Gap Scaling
// Phi^4 (~6.85) yields approx 37px gap for a 255px sidebar.
// This provides a "breathable" text-aware margin.
export const GAP_SCALE = Math.pow(PHI, 4); 
