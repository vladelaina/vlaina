function isEscaped(value: string, offset: number): boolean {
  let backslashCount = 0;
  for (let index = offset - 1; index >= 0 && value[index] === '\\'; index -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function getBacktickRunLength(value: string, start: number): number {
  let cursor = start;
  while (cursor < value.length && value[cursor] === '`') {
    cursor += 1;
  }
  return cursor - start;
}

function findClosingCodeSpan(value: string, start: number, tickCount: number): number | null {
  let cursor = start;
  while (cursor < value.length) {
    if (value[cursor] !== '`') {
      cursor += 1;
      continue;
    }

    const runLength = getBacktickRunLength(value, cursor);
    if (runLength === tickCount) {
      return cursor + runLength;
    }
    cursor += runLength;
  }

  return null;
}

function findImageLabelEnd(value: string, start: number): number | null {
  let cursor = start;
  let bracketDepth = 0;

  while (cursor < value.length) {
    if (value[cursor] === '`') {
      const tickCount = getBacktickRunLength(value, cursor);
      cursor = findClosingCodeSpan(value, cursor + tickCount, tickCount) ?? cursor + tickCount;
      continue;
    }

    const character = value[cursor];
    if (character === '[' && !isEscaped(value, cursor)) {
      bracketDepth += 1;
    } else if (character === ']' && !isEscaped(value, cursor)) {
      if (bracketDepth === 0) {
        return cursor;
      }
      bracketDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function findImageTargetEnd(value: string, start: number): number | null {
  let cursor = start;
  let parenDepth = 0;
  let quote: string | null = null;

  while (cursor < value.length) {
    const character = value[cursor];
    if (quote) {
      if (character === quote && !isEscaped(value, cursor)) {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '\\') {
      cursor += 2;
      continue;
    } else if (character === '(') {
      parenDepth += 1;
    } else if (character === ')') {
      if (parenDepth === 0) {
        return cursor;
      }
      parenDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

export function isMarkdownImageOnlyLine(line: string | null): boolean {
  if (line === null) {
    return false;
  }

  const leadingWhitespaceLength = line.match(/^\s*/)?.[0].length ?? 0;
  if (leadingWhitespaceLength > 3) {
    return false;
  }

  if (!line.startsWith('![', leadingWhitespaceLength) || isEscaped(line, leadingWhitespaceLength)) {
    return false;
  }

  const labelEnd = findImageLabelEnd(line, leadingWhitespaceLength + 2);
  if (labelEnd === null || line[labelEnd + 1] !== '(') {
    return false;
  }

  const targetEnd = findImageTargetEnd(line, labelEnd + 2);
  return targetEnd !== null && line.slice(targetEnd + 1).trim() === '';
}
