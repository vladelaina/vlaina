export function normalizeRangeLimit(maxRanges: number): number {
  return Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
}
