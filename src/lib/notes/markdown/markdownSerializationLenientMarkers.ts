import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import {
  normalizeChineseOrderedListMarkers,
  normalizeFullwidthMarkdownLineMarkers,
  normalizeFullwidthOrderedListDigits,
  normalizeFullwidthTablePipes,
  normalizeMalformedTaskListMarkers,
  normalizeMissingOrderedListMarkerSpaces,
  normalizeMissingUnorderedListMarkerSpaces,
  normalizeUnicodeBulletListMarkers,
} from './markdownSerializationListMarkers';
import {
  CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN,
  MISSING_BLOCKQUOTE_SPACE_PATTERN
} from './markdownSerializationShared';

export function normalizeMissingBlockquoteMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(MISSING_BLOCKQUOTE_SPACE_PATTERN, '$1 $2')
    ).join('\n')
  );
}

export function normalizeCjkAtxHeadingMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(CJK_ATX_HEADING_WITHOUT_SPACE_PATTERN, '$1 $2')
    ).join('\n')
  );
}

export function normalizeLenientMarkdownLineMarkers(text: string): string {
  const afterFullwidthMarkers = normalizeFullwidthMarkdownLineMarkers(text);
  const afterBlockquoteSpaces = normalizeMissingBlockquoteMarkerSpaces(afterFullwidthMarkers);
  const afterHeadingSpaces = normalizeCjkAtxHeadingMarkerSpaces(afterBlockquoteSpaces);
  const afterFullwidthTables = normalizeFullwidthTablePipes(afterHeadingSpaces);
  const afterFullwidthOrderedDigits = normalizeFullwidthOrderedListDigits(afterFullwidthTables);
  const afterChineseOrderedLists = normalizeChineseOrderedListMarkers(afterFullwidthOrderedDigits);
  const afterTaskListMarkers = normalizeMalformedTaskListMarkers(afterChineseOrderedLists);
  const afterUnicodeBulletLists = normalizeUnicodeBulletListMarkers(afterTaskListMarkers);
  const afterMissingUnorderedListSpaces =
    normalizeMissingUnorderedListMarkerSpaces(afterUnicodeBulletLists);
  return normalizeMissingOrderedListMarkerSpaces(afterMissingUnorderedListSpaces);
}
