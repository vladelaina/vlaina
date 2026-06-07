import type { ContentRange } from './markdownRanges';

export function getNonExcludedContentRanges(
  range: ContentRange,
  excludedRanges: readonly ContentRange[],
): ContentRange[] {
  if (excludedRanges.length === 0) {
    return [range];
  }

  const normalizedExcludedRanges = excludedRanges
    .map((excludedRange) => ({
      start: Math.max(range.start, excludedRange.start),
      end: Math.min(range.end, excludedRange.end),
    }))
    .filter((excludedRange) => excludedRange.start < excludedRange.end)
    .sort((left, right) => left.start === right.start ? left.end - right.end : left.start - right.start);
  const ranges: ContentRange[] = [];
  let cursor = range.start;

  for (const excludedRange of normalizedExcludedRanges) {
    if (excludedRange.end <= cursor) {
      continue;
    }
    if (excludedRange.start > cursor) {
      ranges.push({ start: cursor, end: excludedRange.start });
    }
    cursor = Math.max(cursor, excludedRange.end);
    if (cursor >= range.end) {
      break;
    }
  }

  if (cursor < range.end) {
    ranges.push({ start: cursor, end: range.end });
  }

  return ranges;
}
