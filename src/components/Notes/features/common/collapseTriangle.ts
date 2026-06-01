import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

export const COLLAPSE_TRIANGLE_VIEW_BOX = '0 0 24 24';
export const COLLAPSE_TRIANGLE_PATH = 'M6 9l6 6 6-6';

export function createCollapseTriangleSvgMarkup(size = themeIconTokens.sizeCollapseTriangle): string {
  const normalizedSize = Number.isFinite(size) && size > 0 ? Math.round(size) : themeIconTokens.sizeCollapseTriangle;
  return `<svg width="${normalizedSize}" height="${normalizedSize}" viewBox="${COLLAPSE_TRIANGLE_VIEW_BOX}" fill="${themeStyleResetTokens.fillNone}" stroke="${themeStyleResetTokens.currentColor}" stroke-width="${themeIconTokens.strokeCollapseTriangle}" stroke-linecap="round" stroke-linejoin="round"><path d="${COLLAPSE_TRIANGLE_PATH}"/></svg>`;
}
