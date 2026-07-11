export const APP_VIEW_MODE_SWITCH_MIN_WIDTH = 184;
export const SIDEBAR_CAPSULE_HORIZONTAL_CHROME_WIDTH = 40;
export const SIDEBAR_MIN_WIDTH =
  APP_VIEW_MODE_SWITCH_MIN_WIDTH + SIDEBAR_CAPSULE_HORIZONTAL_CHROME_WIDTH;
export const SIDEBAR_MAX_WIDTH = 560;
export const SIDEBAR_DEFAULT_WIDTH = 270;

export function clampSidebarWidth(width: number): number {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, width));
}

export function getDefaultSidebarWidth(): number {
  return clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
}
