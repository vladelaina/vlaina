const FENCED_CODE_MARKER_PATTERN = /^([ \t]*)(`{3,}|~{3,})/;
const FENCED_CODE_CLOSING_PATTERN = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/;

type FenceClosingMatch = {
  closeIndex: number;
  closingIndent: string;
};

function stripLineIndent(line: string, indent: string): string {
  return indent.length > 0 && line.startsWith(indent)
    ? line.slice(indent.length)
    : line;
}

export function normalizeSelectedFencedCodeIndent(text: string): string {
  const lines = text.split('\n');
  const closingMatches = collectNextFenceClosingMatches(lines);

  for (let index = 0; index < lines.length; index += 1) {
    const opening = FENCED_CODE_MARKER_PATTERN.exec(lines[index] ?? '');
    if (!opening) continue;

    const openingIndent = opening[1] ?? '';
    const closing = closingMatches[index];
    if (!closing) continue;

    const indentToStrip = openingIndent || closing.closingIndent;
    if (indentToStrip.length > 0) {
      for (let lineIndex = index; lineIndex <= closing.closeIndex; lineIndex += 1) {
        lines[lineIndex] = stripLineIndent(lines[lineIndex] ?? '', indentToStrip);
      }
    }

    index = closing.closeIndex;
  }

  return lines.join('\n');
}

function collectNextFenceClosingMatches(lines: readonly string[]): Array<FenceClosingMatch | null> {
  const matches: Array<FenceClosingMatch | null> = Array.from({ length: lines.length }, () => null);
  const nearestClosingByMarker = new Map<string, Array<FenceClosingMatch | null>>();

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    const opening = FENCED_CODE_MARKER_PATTERN.exec(line);
    if (opening) {
      const marker = opening[2] ?? '';
      const markerChar = marker[0];
      if (markerChar) {
        matches[index] = nearestClosingByMarker.get(markerChar)?.[marker.length] ?? null;
      }
    }

    const closing = FENCED_CODE_CLOSING_PATTERN.exec(line);
    if (!closing) continue;

    const closingMarker = closing[2] ?? '';
    const markerChar = closingMarker[0];
    if (!markerChar) continue;

    const nearestByLength = nearestClosingByMarker.get(markerChar) ?? [];
    const closingMatch = {
      closeIndex: index,
      closingIndent: closing[1] ?? '',
    };
    for (let markerLength = 3; markerLength <= closingMarker.length; markerLength += 1) {
      nearestByLength[markerLength] = closingMatch;
    }
    nearestClosingByMarker.set(markerChar, nearestByLength);
  }

  return matches;
}

export function stripCommonContinuationIndent(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= 1) return text;

  let commonIndent: string | null = null;
  for (const line of lines.slice(1)) {
    if (line.length === 0) continue;
    const indent = /^([ \t]*)/.exec(line)?.[1] ?? '';
    if (indent.length === 0) return text;
    commonIndent = commonIndent === null
      ? indent
      : commonIndent.slice(0, commonPrefixLength(commonIndent, indent));
    if (commonIndent.length === 0) return text;
  }

  if (!commonIndent) return text;
  return [
    lines[0] ?? '',
    ...lines.slice(1).map((line) => stripLineIndent(line, commonIndent)),
  ].join('\n');
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

export function trimLeadingBlankLines(text: string): string {
  const lines = text.split('\n');
  let start = 0;
  while (start < lines.length - 1 && (lines[start] ?? '').trim().length === 0) {
    start += 1;
  }
  return start === 0 ? text : lines.slice(start).join('\n');
}
