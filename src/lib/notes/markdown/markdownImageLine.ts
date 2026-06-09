type MarkdownImageLineScanContext = {
  escaped: boolean[];
};

function createMarkdownImageLineScanContext(value: string): MarkdownImageLineScanContext {
  const escaped = Array.from({ length: value.length }, () => false);
  let backslashRun = 0;

  for (let index = 0; index < value.length; index += 1) {
    escaped[index] = backslashRun % 2 === 1;
    if (value[index] === '\\') {
      backslashRun += 1;
    } else {
      backslashRun = 0;
    }
  }

  return { escaped };
}

function isEscaped(context: MarkdownImageLineScanContext, offset: number): boolean {
  return context.escaped[offset] === true;
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

function findImageLabelEnd(value: string, start: number, context: MarkdownImageLineScanContext): number | null {
  let cursor = start;
  let bracketDepth = 0;

  while (cursor < value.length) {
    if (value[cursor] === '`') {
      const tickCount = getBacktickRunLength(value, cursor);
      cursor = findClosingCodeSpan(value, cursor + tickCount, tickCount) ?? cursor + tickCount;
      continue;
    }

    const character = value[cursor];
    if (character === '[' && !isEscaped(context, cursor)) {
      bracketDepth += 1;
    } else if (character === ']' && !isEscaped(context, cursor)) {
      if (bracketDepth === 0) {
        return cursor;
      }
      bracketDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function findImageTargetEnd(value: string, start: number, context: MarkdownImageLineScanContext): number | null {
  let cursor = start;
  let parenDepth = 0;
  let quote: string | null = null;

  while (cursor < value.length && /\s/.test(value[cursor])) {
    cursor += 1;
  }

  if (value[cursor] === '<') {
    cursor += 1;
    while (cursor < value.length) {
      const character = value[cursor];
      if (character === '\n') {
        return null;
      }
      if (character === '>' && !isEscaped(context, cursor)) {
        cursor += 1;
        break;
      }
      cursor += 1;
    }
    if (cursor >= value.length && value[cursor - 1] !== '>') {
      return null;
    }
  }

  while (cursor < value.length) {
    const character = value[cursor];
    if (quote) {
      if (character === quote && !isEscaped(context, cursor)) {
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

  const context = createMarkdownImageLineScanContext(line);
  if (!line.startsWith('![', leadingWhitespaceLength) || isEscaped(context, leadingWhitespaceLength)) {
    return false;
  }

  const labelEnd = findImageLabelEnd(line, leadingWhitespaceLength + 2, context);
  if (labelEnd === null || line[labelEnd + 1] !== '(') {
    return false;
  }

  const targetEnd = findImageTargetEnd(line, labelEnd + 2, context);
  return targetEnd !== null && line.slice(targetEnd + 1).trim() === '';
}
