const CARRIAGE_RETURN_CODE = 13;
const LINE_FEED_CODE = 10;

export function readNormalizedMarkdownLine(
  markdown: string,
  offset: number,
  maxEnd = markdown.length,
): { line: string; nextOffset: number } | null {
  const length = Math.min(markdown.length, maxEnd);
  if (offset > length) {
    return null;
  }
  if (offset === length) {
    const lastCode = markdown.charCodeAt(length - 1);
    return lastCode === LINE_FEED_CODE || lastCode === CARRIAGE_RETURN_CODE
      ? { line: '', nextOffset: length + 1 }
      : null;
  }

  for (let index = offset; index < length; index += 1) {
    const code = markdown.charCodeAt(index);
    if (code === LINE_FEED_CODE || code === CARRIAGE_RETURN_CODE) {
      return {
        line: markdown.slice(offset, index),
        nextOffset: code === CARRIAGE_RETURN_CODE && markdown.charCodeAt(index + 1) === LINE_FEED_CODE
          ? index + 2
          : index + 1,
      };
    }
  }

  return {
    line: markdown.slice(offset),
    nextOffset: length,
  };
}

export function collectMarkdownSectionLines(
  markdown: string,
  startOffset: number,
  maxEnd: number,
  isSectionBoundaryLine: (line: string) => boolean,
): { endOffset: number; lines: string[] } {
  const sectionLines: string[] = [];
  let offset = startOffset;

  while (true) {
    const current = readNormalizedMarkdownLine(markdown, offset, maxEnd);
    if (!current) {
      break;
    }

    const line = current.line;
    if (!line.trim()) {
      break;
    }
    if (offset !== startOffset && isSectionBoundaryLine(line)) {
      break;
    }

    sectionLines.push(line);
    offset = current.nextOffset;
  }

  return { endOffset: offset, lines: sectionLines };
}
