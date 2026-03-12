export const COLLAPSE_TRIANGLE_VIEW_BOX = '0 0 24 24';
export const COLLAPSE_TRIANGLE_PATH = 'M6 9l6 6 6-6';

export function createCollapseTriangleSvgMarkup(size = 16): string {
  const normalizedSize = Number.isFinite(size) && size > 0 ? Math.round(size) : 16;
  return `<svg width="${normalizedSize}" height="${normalizedSize}" viewBox="${COLLAPSE_TRIANGLE_VIEW_BOX}" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="${COLLAPSE_TRIANGLE_PATH}"/></svg>`;
}
