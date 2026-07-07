import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import { normalizeEditorBreakPlaceholders } from './markdownSerializationEditorBreaks';
import { normalizeInternalMarkdownBlankLineComments } from './markdownSerializationInternalBlankComments';
import {
  LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN,
  LEAKED_USER_BR_SENTINEL_PATTERN,
  LIST_GAP_SENTINEL,
  MarkdownFenceLine,
  NESTED_LIST_ITEM_LINE_PATTERN,
  SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN,
  USER_BR_SENTINEL,
  USER_BR_SENTINEL_LINE_PATTERN
} from './markdownSerializationShared';

export function normalizeUserBreakSentinels(text: string): string {
  if (!text.includes(USER_BR_SENTINEL)) return text;

  return mapMarkdownOutsideProtectedSegments(text, normalizeUserBreakSentinelSegment);
}

export function normalizeUserBreakSentinelSegment(segment: string): string {
  const lines = segment.split('\n');
  const output: string[] = [];

  for (const line of lines) {
    const sentinelMatch = USER_BR_SENTINEL_LINE_PATTERN.exec(line);
    if (!sentinelMatch) {
      output.push(line);
      continue;
    }

    const prefix = sentinelMatch[1] ?? '';
    const previousIndex = output.length - 1;
    const previousLine = previousIndex >= 0 ? output[previousIndex] : null;

    if (previousLine !== null && !isEditorPlaceholderBlankLine(previousLine)) {
      output[previousIndex] = previousLine.replace(/[ \t]*$/, '\\');
      continue;
    }

    output.push(`${prefix}<br />`);
  }

  return output.join('\n')
    .replace(/\n{3,}(<br \/>)/g, '\n\n$1')
    .replace(/(<br \/>)\n{3,}/g, '$1\n\n');
}

export function isEditorPlaceholderBlankLine(line: string): boolean {
  return line.replace(/\\?\u200B|\\?\u200C/g, '').trim().length === 0;
}

export function normalizeListItemBlankLines(text: string): string {
  if (!text.includes(LIST_GAP_SENTINEL) && !text.includes('\u2800')) {
    return text;
  }

  const normalizedPlaceholders = text.includes('\u2800')
    ? normalizeSerializedListGapMarkerLines(text)
    : text;

  const normalizedSentinels = normalizedPlaceholders.includes(LIST_GAP_SENTINEL)
    ? mapMarkdownOutsideProtectedSegments(
      normalizedPlaceholders,
      replaceListGapSentinelsWithBlankLines,
    )
    : normalizedPlaceholders;

  return normalizedSentinels.includes('\u2800')
    ? mapMarkdownOutsideProtectedSegments(
      normalizedSentinels,
      replaceListGapSentinelsWithBlankLines,
    )
    : normalizedSentinels;
}

export function normalizeSerializedListGapMarkerLines(text: string): string {
  const lines = text.split('\n');
  const nearestNonBlankLines = collectNearestNonBlankLines(lines);
  let activeFence: { marker: string; length: number } | null = null;

  return lines
    .map((line, index) => {
      const fence = parseMarkdownFenceLine(line);
      if (activeFence) {
        if (
          fence?.marker === activeFence.marker
          && fence.length >= activeFence.length
          && isBlankMarkdownFenceInfo(line, fence.infoStart)
        ) {
          activeFence = null;
        }
        return line;
      }
      if (fence) {
        if (fence.marker !== '`' || line.indexOf('`', fence.infoStart) === -1) {
          activeFence = { marker: fence.marker, length: fence.length };
        }
        return line;
      }

      return SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN.test(line)
        && (
          isNestedListItemLine(nearestNonBlankLines.previous[index] ?? null)
          || isNestedListItemLine(nearestNonBlankLines.next[index] ?? null)
        )
        ? LIST_GAP_SENTINEL
        : line;
    })
    .join('\n');
}

export function parseMarkdownFenceLine(line: string): MarkdownFenceLine | null {
  let index = 0;
  while (index < line.length && index <= 3 && line[index] === ' ') {
    index += 1;
  }
  if (index > 3) return null;

  const marker = line[index];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (line[index + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return {
    infoStart: index + length,
    length,
    marker,
  };
}

export function isBlankMarkdownFenceInfo(line: string, start: number): boolean {
  for (let index = start; index < line.length; index += 1) {
    const character = line[index];
    if (character !== ' ' && character !== '\t') {
      return false;
    }
  }
  return true;
}

export function isNestedListItemLine(line: string | null): boolean {
  return line !== null && NESTED_LIST_ITEM_LINE_PATTERN.test(line);
}

export function collectNearestNonBlankLines(lines: readonly string[]): { previous: Array<string | null>; next: Array<string | null> } {
  const previous: Array<string | null> = Array.from({ length: lines.length }, () => null);
  const next: Array<string | null> = Array.from({ length: lines.length }, () => null);
  let nearest: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    previous[index] = nearest;
    const line = lines[index] ?? '';
    if (line.trim()) {
      nearest = line;
    }
  }

  nearest = null;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    next[index] = nearest;
    const line = lines[index] ?? '';
    if (line.trim()) {
      nearest = line;
    }
  }

  return { previous, next };
}

export function replaceListGapSentinelsWithBlankLines(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  let previousWasListGapSentinel = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line !== LIST_GAP_SENTINEL && !SERIALIZED_EDITABLE_LIST_GAP_PLACEHOLDER_PATTERN.test(line)) {
      output.push(line);
      previousWasListGapSentinel = false;
      continue;
    }

    while (
      !previousWasListGapSentinel
      && output.length > 0
      && output[output.length - 1]?.trim() === ''
    ) {
      output.pop();
    }
    output.push('');
    previousWasListGapSentinel = true;

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return output.join('\n');
}

export function normalizeInternalClipboardArtifacts(text: string): string {
  return collapseInternalClipboardBlankLineRuns(
    normalizeLeakedInternalArtifacts(
      normalizeListItemBlankLines(
        normalizeInternalMarkdownBlankLineComments(normalizeEditorBreakPlaceholders(text))
      )
    )
  );
}

export function collapseInternalClipboardBlankLineRuns(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.replace(/\n{3,}/g, '\n\n')
  );
}

export function normalizeLeakedInternalArtifacts(text: string): string {
  if (!text.includes('VLAINA_') || !text.includes('�')) {
    return text;
  }

  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment
      .replace(LEAKED_LIST_GAP_SENTINEL_WITH_NEWLINES_PATTERN, '\n\n')
      .replace(LEAKED_USER_BR_SENTINEL_PATTERN, USER_BR_SENTINEL)
  );
}
