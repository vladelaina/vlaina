export const ICON_SIZES = {
  xs: 12,
  sm: 14,
  sidebar: 15,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSize = keyof typeof ICON_SIZES;
