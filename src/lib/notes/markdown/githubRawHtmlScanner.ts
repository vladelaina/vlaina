export interface RawHtmlTag {
  closing: boolean;
  end: number;
  malformed: boolean;
  name: string;
  selfClosing: boolean;
}

const MAX_RAW_HTML_TAG_END_SCAN_CHARS = 64 * 1024;
const MAX_RAW_HTML_TAG_NAME_CHARS = 128;
const MAX_RAW_HTML_CONTAINER_MARKUP_SCANS = 20_000;

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

function readRawHtmlTagStart(content: string, start: number): { closing: boolean; name: string; overlongName?: boolean } | null {
  if (content[start] !== '<') return null;

  let cursor = start + 1;
  const closing = content[cursor] === '/';
  if (closing) cursor += 1;
  if (!isAsciiAlpha(content[cursor])) return null;

  const nameStart = cursor;
  cursor += 1;
  while (isHtmlNameChar(content[cursor])) {
    cursor += 1;
    if (cursor - nameStart > MAX_RAW_HTML_TAG_NAME_CHARS) {
      return {
        closing,
        name: content.slice(nameStart, nameStart + MAX_RAW_HTML_TAG_NAME_CHARS).toLowerCase(),
        overlongName: true,
      };
    }
  }

  if (!isTagBoundary(content[cursor])) return null;
  return { closing, name: content.slice(nameStart, cursor).toLowerCase() };
}

function findRawHtmlTagEnd(content: string, start: number, end: number): number {
  let quote: string | null = null;

  for (let cursor = start + 1; cursor < end; cursor += 1) {
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

function getRawHtmlTagScanEnd(content: string, start: number): number {
  return Math.min(content.length, start + MAX_RAW_HTML_TAG_END_SCAN_CHARS + 1);
}

function getMalformedRawHtmlTagEnd(content: string, start: number): number {
  const lineFeed = content.indexOf('\n', start);
  const carriageReturn = content.indexOf('\r', start);
  const lineEnd = Math.min(
    lineFeed === -1 ? content.length : lineFeed,
    carriageReturn === -1 ? content.length : carriageReturn,
    content.length,
  );
  return Math.min(content.length, Math.max(start + 1, lineEnd));
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
  if (tagStart.overlongName) {
    return {
      closing: tagStart.closing,
      end: getMalformedRawHtmlTagEnd(content, start),
      malformed: true,
      name: tagStart.name,
      selfClosing: true,
    };
  }

  const scanEnd = getRawHtmlTagScanEnd(content, start);
  const tagEnd = findRawHtmlTagEnd(content, start, scanEnd);
  const malformed = tagEnd === -1 && scanEnd < content.length;
  const end = tagEnd === -1
    ? malformed ? getMalformedRawHtmlTagEnd(content, start) : content.length
    : tagEnd;

  return {
    closing: tagStart.closing,
    end,
    malformed,
    name: tagStart.name,
    selfClosing: malformed || isSelfClosingRawHtmlTag(content, start, end),
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
  let scannedMarkupStarts = 0;
  while (cursor < content.length) {
    const nextTagStart = content.indexOf('<', cursor);
    if (nextTagStart === -1) {
      return { closeEnd: null, depth };
    }
    scannedMarkupStarts += 1;
    if (scannedMarkupStarts > MAX_RAW_HTML_CONTAINER_MARKUP_SCANS) {
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
