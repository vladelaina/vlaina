import { themeIconTokens } from '@/styles/themeTokens';

export const ICON_SIZES = {
  xs: themeIconTokens.sizeXs,
  sm: themeIconTokens.sizeSm,
  sidebar: themeIconTokens.sizeSidebar,
  md: themeIconTokens.sizeMd,
  titlebarToggle: themeIconTokens.sizeTitlebarToggle,
  lg: themeIconTokens.sizeLg,
  xl: themeIconTokens.sizeXl,
} as const;

export type IconSize = keyof typeof ICON_SIZES;
