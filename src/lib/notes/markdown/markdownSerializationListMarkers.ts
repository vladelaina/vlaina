import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import {
  CHINESE_ORDERED_LIST_MARKER_PATTERN,
  FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN, FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN, FULLWIDTH_TABLE_PIPE_PATTERN,
  MALFORMED_TASK_LIST_MARKER_PATTERN,
  MISSING_ORDERED_LIST_SPACE_LINE_PATTERN, MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN,
  TABLE_DELIMITER_ROW_PATTERN,
  TABLE_ROW_PATTERN,
  UNICODE_BULLET_LIST_LINE_PATTERN
} from './markdownSerializationShared';

export function normalizeMissingOrderedListMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = MISSING_ORDERED_LIST_SPACE_LINE_PATTERN.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let previousNumber = Number(firstMatch[2]);

      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;

        const nextMatch = MISSING_ORDERED_LIST_SPACE_LINE_PATTERN.exec(lines[cursor] ?? '');
        if (!nextMatch) break;

        const nextNumber = Number(nextMatch[2]);
        if (nextNumber !== previousNumber + 1) break;

        run.push(cursor);
        previousNumber = nextNumber;
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            MISSING_ORDERED_LIST_SPACE_LINE_PATTERN,
            (_match: string, rawMarker: string, _number: string, content: string) =>
              `${normalizeBlockquotePrefixedMarker(rawMarker)} ${content}`
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeChineseOrderedListMarkers(text: string): string {
  return normalizeConsecutiveOrderedMarkerRun(text, CHINESE_ORDERED_LIST_MARKER_PATTERN);
}

export function normalizeMissingUnorderedListMarkerSpaces(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;
        if (!MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN.test(lines[cursor] ?? '')) break;
        run.push(cursor);
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            MISSING_UNORDERED_LIST_SPACE_LINE_PATTERN,
            (_match: string, rawMarker: string, _symbol: string, content: string) => {
              const normalizedMarker = normalizeMarkdownListMarkerSymbols(rawMarker);
              return `${normalizeBlockquotePrefixedMarker(normalizedMarker)} ${content}`;
            }
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeUnicodeBulletListMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = UNICODE_BULLET_LIST_LINE_PATTERN.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;
        if (!UNICODE_BULLET_LIST_LINE_PATTERN.test(lines[cursor] ?? '')) break;
        run.push(cursor);
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            UNICODE_BULLET_LIST_LINE_PATTERN,
            (_match: string, rawMarker: string, _symbol: string, content: string) =>
              `${normalizeBlockquotePrefixedMarker(rawMarker.replace(/[•‣◦]/u, '-'))} ${content}`
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeMalformedTaskListMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) => {
      const match = MALFORMED_TASK_LIST_MARKER_PATTERN.exec(line);
      if (!match) return line;

      const marker = normalizeMarkdownListMarkerSymbols(match[1] ?? '');
      const checkedValue = match[2] ?? match[3] ?? match[4] ?? '';
      const checked = checkedValue ? 'x' : ' ';
      const content = match[5] ?? '';
      const taskMarker = `${normalizeBlockquotePrefixedMarker(marker)} [${checked}]`;
      return content.length > 0 ? `${taskMarker} ${content}` : taskMarker;
    }).join('\n')
  );
}

export function normalizeFullwidthMarkdownLineMarkers(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(/^((?: {0,3}＞[ \t]?)+)/u, (prefix: string) =>
        prefix.replace(/＞/g, '>')
      ).replace(
        FULLWIDTH_MARKDOWN_LINE_MARKER_PATTERN,
        (_match, prefix: string, marker: string, rest: string) => {
          const normalizedMarker = marker
            .replace(/＃/g, '#')
            .replace('＞', '>');
          return `${prefix.replace(/＞/g, '>')}${normalizedMarker}${rest}`;
        }
      )
    ).join('\n')
  );
}

export function normalizeFullwidthDigitRun(value: string): string {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0));
}

export function normalizeFullwidthOrderedListDigits(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) =>
    segment.split('\n').map((line) =>
      line.replace(
        FULLWIDTH_ORDERED_LIST_DIGIT_PATTERN,
        (_match: string, prefix: string, digits: string) => `${prefix}${normalizeFullwidthDigitRun(digits)}`
      )
    ).join('\n')
  );
}

export function normalizeFullwidthTableLine(line: string): string {
  return line.replace(FULLWIDTH_TABLE_PIPE_PATTERN, '|');
}

export function isFullwidthTableCandidateLine(line: string): boolean {
  return line.includes('｜') && TABLE_ROW_PATTERN.test(normalizeFullwidthTableLine(line));
}

export function isFullwidthTableDelimiterLine(line: string): boolean {
  return TABLE_DELIMITER_ROW_PATTERN.test(normalizeFullwidthTableLine(line));
}

export function normalizeFullwidthTablePipes(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      if (!isFullwidthTableCandidateLine(lines[index] ?? '')) continue;

      let end = index;
      while (end < lines.length && isFullwidthTableCandidateLine(lines[end] ?? '')) {
        end += 1;
      }

      const hasDelimiter = lines.slice(index, end).some(isFullwidthTableDelimiterLine);
      if (hasDelimiter && end - index >= 2) {
        for (let lineIndex = index; lineIndex < end; lineIndex += 1) {
          output[lineIndex] = normalizeFullwidthTableLine(lines[lineIndex] ?? '');
        }
      }

      index = end - 1;
    }

    return output.join('\n');
  });
}

export function normalizeConsecutiveOrderedMarkerRun(text: string, pattern: RegExp): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output = [...lines];

    for (let index = 0; index < lines.length; index += 1) {
      const firstMatch = pattern.exec(lines[index] ?? '');
      if (!firstMatch) continue;

      const run: number[] = [index];
      let previousNumber = Number(firstMatch[2]);
      if (previousNumber > 1) continue;

      let cursor = index + 1;
      for (; cursor < lines.length; cursor += 1) {
        if ((lines[cursor] ?? '').trim().length === 0) continue;

        const nextMatch = pattern.exec(lines[cursor] ?? '');
        if (!nextMatch) break;

        const nextNumber = Number(nextMatch[2]);
        if (nextNumber !== previousNumber + 1) break;

        run.push(cursor);
        previousNumber = nextNumber;
      }

      if (run.length >= 2) {
        for (const lineIndex of run) {
          output[lineIndex] = (lines[lineIndex] ?? '').replace(
            pattern,
            (_match: string, rawMarker: string, number: string, content: string) => {
              const numberIndex = rawMarker.indexOf(number);
              const prefix = (numberIndex >= 0 ? rawMarker.slice(0, numberIndex) : '')
                .replace(/[（(][ \t]*$/, '');
              return `${normalizeBlockquotePrefixedMarker(`${prefix}${number}.`)} ${content}`;
            }
          );
        }
      }

      index = Math.max(index, cursor - 1);
    }

    return output.join('\n');
  });
}

export function normalizeBlockquotePrefixedMarker(marker: string): string {
  const match = /^((?: {0,3}>[ \t]?)*)(.*)$/.exec(marker);
  if (!match) return marker;

  const blockquotePrefix = match[1] ?? '';
  const markerBody = match[2] ?? '';
  if (!blockquotePrefix) return marker;

  const leadingIndent = /^( {0,3})/.exec(blockquotePrefix)?.[1] ?? '';
  const depth = blockquotePrefix.match(/>/g)?.length ?? 0;
  if (depth <= 0) return marker;

  return `${leadingIndent}${Array.from({ length: depth }, () => '>').join(' ')} ${markerBody}`;
}

export function normalizeMarkdownListMarkerSymbols(marker: string): string {
  return marker
    .replace(/－/g, '-')
    .replace(/＊/g, '*')
    .replace(/＋/g, '+');
}
