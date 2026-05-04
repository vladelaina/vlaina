import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';

const ATX_HEADING_PATTERN = /^(?: {0,3})#{1,6}(?:\s|$)/;
const EMPTY_LINE_PLACEHOLDER_PATTERN = /^[\t ]*\\?\u200B[\t ]*$/;
const MARKED_EMPTY_LINE_PATTERN =
  /^<br\b(?=[^>]*\bdat[ae]-vla(?:ina|ian)-?(?:empty|empt)-line=(?:"true"|'true'|true\b))[^>]*\/?>\s*(?:<\/br>)?$/i;

function isAtxHeading(line: string): boolean {
  return ATX_HEADING_PATTERN.test(line);
}

export function collapseSyntheticBlankLinesBetweenAdjacentHeadings(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      if (!isAtxHeading(line)) {
        output.push(line);
        continue;
      }

      output.push(line);

      let nextIndex = index + 1;
      while (nextIndex < lines.length && (lines[nextIndex] ?? '').trim() === '') {
        nextIndex += 1;
      }

      const blankLineCount = nextIndex - index - 1;
      if (blankLineCount === 0) {
        continue;
      }

      if (nextIndex < lines.length && isAtxHeading(lines[nextIndex] ?? '')) {
        index = nextIndex - 1;
        continue;
      }

      for (let blankIndex = 0; blankIndex < blankLineCount; blankIndex += 1) {
        output.push('');
      }
      index = nextIndex - 1;
    }

    return output.join('\n');
  });
}

export function collapseSyntheticBlankLinesAroundEmptyPlaceholders(text: string): string {
  return mapMarkdownOutsideProtectedSegments(text, (segment) => {
    const lines = segment.split('\n');
    const output: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      const isEmptyPlaceholder =
        EMPTY_LINE_PLACEHOLDER_PATTERN.test(line)
        || MARKED_EMPTY_LINE_PATTERN.test(line.trim());

      if (!isEmptyPlaceholder) {
        output.push(line);
        continue;
      }

      const hasPreviousContent = output.some((outputLine) => outputLine.trim() !== '');
      if (hasPreviousContent) {
        while (output.length > 0 && (output[output.length - 1] ?? '').trim() === '') {
          output.pop();
        }
      }

      output.push(line);

      const hasNextContent = lines
        .slice(index + 1)
        .some((nextLine) => nextLine.trim() !== '');
      if (hasNextContent) {
        while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
          index += 1;
        }
      }
    }

    return output.join('\n');
  });
}
