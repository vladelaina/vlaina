export const PHI = 1.618033988749895;

// Safety gap scale factor (Phi^4 ≈ 6.854)
// This determines how "shy" the text is when the sidebar peeks.
export const GAP_SCALE = Math.pow(PHI, 4);

export const CONTENT_MAX_WIDTH = 900;

// Tailwind spacing values (4px grid)
// px-24 = 96px
export const PADDING_DESKTOP = 96;
// px-12 = 48px
export const PADDING_MOBILE = 48;

export const EDITOR_LAYOUT_CLASS = "w-full max-w-[900px] px-12 md:px-24 shrink-0";
