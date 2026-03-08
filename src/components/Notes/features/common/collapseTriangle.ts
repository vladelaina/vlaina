export const COLLAPSE_TRIANGLE_VIEW_BOX = '0 0 24 24';
export const COLLAPSE_TRIANGLE_PATH = 'M13.15 15.132a.757.757 0 0 1-1.3 0L8.602 9.605c-.29-.491.072-1.105.65-1.105h6.497c.577 0 .938.614.65 1.105z';

export function createCollapseTriangleSvgMarkup(size = 16): string {
  const normalizedSize = Number.isFinite(size) && size > 0 ? Math.round(size) : 16;
  return `<svg width="${normalizedSize}" height="${normalizedSize}" viewBox="${COLLAPSE_TRIANGLE_VIEW_BOX}" fill="currentColor"><path d="${COLLAPSE_TRIANGLE_PATH}"/></svg>`;
}
