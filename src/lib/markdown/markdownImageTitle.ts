function isEscapedAtOffset(content: string, offset: number, lowerBound: number): boolean {
  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= lowerBound && content[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function skipMarkdownImageTitle(content: string, start: number, maxScanEnd = content.length): number | null {
  const titleStart = start;
  const opener = content[titleStart];
  if (opener !== '"' && opener !== "'" && opener !== "(") {
    return null;
  }

  const closer = opener === "(" ? ")" : opener;
  let depth = opener === "(" ? 1 : 0;
  let cursor = titleStart + 1;
  while (cursor < content.length && cursor < maxScanEnd) {
    const ch = content[cursor];
    if (isEscapedAtOffset(content, cursor, titleStart)) {
      cursor += 1;
      continue;
    }
    if (opener === "(" && ch === "(") {
      depth += 1;
      cursor += 1;
      continue;
    }
    if (ch === closer) {
      if (opener !== "(" || depth === 1) {
        return cursor + 1;
      }
      depth -= 1;
    }
    cursor += 1;
  }

  return null;
}

export function parseMarkdownImageClosingParen(content: string, start: number, maxScanEnd = content.length): number | null {
  let cursor = start;
  while (cursor < content.length && cursor < maxScanEnd && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  if (content[cursor] === ")") {
    return cursor + 1;
  }

  const titleEnd = skipMarkdownImageTitle(content, cursor, maxScanEnd);
  if (titleEnd === null) {
    return null;
  }

  cursor = titleEnd;
  while (cursor < content.length && cursor < maxScanEnd && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  return content[cursor] === ")" ? cursor + 1 : null;
}
