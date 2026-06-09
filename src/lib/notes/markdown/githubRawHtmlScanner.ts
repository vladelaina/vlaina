export interface RawHtmlTag {
  closing: boolean;
  end: number;
  name: string;
  selfClosing: boolean;
}

function isAsciiAlpha(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isHtmlNameChar(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return (
    (code >= 65 && code <= 90)
    || (code >= 97 && code <= 122)
    || (code >= 48 && code <= 57)
    || char === ':'
    || char === '-'
  );
}

function isTagBoundary(char: string | undefined): boolean {
  if (char === undefined || char === '>' || char === '/') return true;
  const code = char.charCodeAt(0);
  return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

function readRawHtmlTagStart(content: string, start: number): { closing: boolean; name: string } | null {
  if (content[start] !== '<') return null;

  let cursor = start + 1;
  const closing = content[cursor] === '/';
  if (closing) cursor += 1;
  if (!isAsciiAlpha(content[cursor])) return null;

  const nameStart = cursor;
  cursor += 1;
  while (isHtmlNameChar(content[cursor])) {
    cursor += 1;
  }

  if (!isTagBoundary(content[cursor])) return null;
  return { closing, name: content.slice(nameStart, cursor).toLowerCase() };
}

function findRawHtmlTagEnd(content: string, start: number): number {
  let quote: string | null = null;

  for (let cursor = start + 1; cursor < content.length; cursor += 1) {
    const char = content[cursor];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') {
      return cursor + 1;
    }
  }

  return -1;
}

function findHtmlCommentEnd(content: string, start: number): number {
  const end = content.indexOf('-->', start + 4);
  return end === -1 ? content.length : end + 3;
}

function findHtmlCdataEnd(content: string, start: number): number {
  const end = content.indexOf(']]>', start + 9);
  return end === -1 ? content.length : end + 3;
}

function findHtmlProcessingInstructionEnd(content: string, start: number): number {
  const end = content.indexOf('?>', start + 2);
  return end === -1 ? content.length : end + 2;
}

function findHtmlDeclarationEnd(content: string, start: number): number {
  const end = content.indexOf('>', start + 2);
  return end === -1 ? content.length : end + 1;
}

export function findRawHtmlNonTagEnd(content: string, start: number): number | null {
  if (content.startsWith('<!--', start)) return findHtmlCommentEnd(content, start);
  if (content.startsWith('<![CDATA[', start)) return findHtmlCdataEnd(content, start);
  if (content.startsWith('<?', start)) return findHtmlProcessingInstructionEnd(content, start);
  if (content.startsWith('<!', start)) return findHtmlDeclarationEnd(content, start);
  return null;
}

export function parseRawHtmlTag(content: string, start: number): RawHtmlTag | null {
  if (findRawHtmlNonTagEnd(content, start) !== null) return null;

  const tagStart = readRawHtmlTagStart(content, start);
  if (!tagStart) return null;

  const end = findRawHtmlTagEnd(content, start);
  if (end === -1) {
    return {
      closing: tagStart.closing,
      end: content.length,
      name: tagStart.name,
      selfClosing: false,
    };
  }

  return {
    closing: tagStart.closing,
    end,
    name: tagStart.name,
    selfClosing: isSelfClosingRawHtmlTag(content, start, end),
  };
}

function isSelfClosingRawHtmlTag(content: string, start: number, end: number): boolean {
  if (content[end - 1] !== '>') return false;

  let cursor = end - 1;
  while (cursor >= start) {
    const char = content[cursor];
    if (char === '>') {
      cursor -= 1;
      continue;
    }
    if (isTagBoundaryWhitespace(char)) {
      cursor -= 1;
      continue;
    }
    return char === '/';
  }
  return false;
}

function isTagBoundaryWhitespace(char: string | undefined): boolean {
  if (char === undefined) return false;
  const code = char.charCodeAt(0);
  return code === 32 || code === 9 || code === 10 || code === 12 || code === 13;
}

export function scanRawHtmlContainer(
  content: string,
  tagName: string,
  start: number,
  initialDepth: number,
): { closeEnd: number | null; depth: number } {
  let cursor = start;
  let depth = Math.max(1, initialDepth);
  while (cursor < content.length) {
    const nextTagStart = content.indexOf('<', cursor);
    if (nextTagStart === -1) {
      return { closeEnd: null, depth };
    }

    const nextTag = parseRawHtmlTag(content, nextTagStart);
    if (!nextTag) {
      cursor = findRawHtmlNonTagEnd(content, nextTagStart) ?? nextTagStart + 1;
      continue;
    }

    if (nextTag.name === tagName) {
      if (nextTag.closing) {
        depth -= 1;
        if (depth <= 0) {
          return { closeEnd: nextTag.end, depth: 0 };
        }
      } else if (!nextTag.selfClosing) {
        depth += 1;
      }
    }

    cursor = nextTag.end;
  }

  return { closeEnd: null, depth };
}
