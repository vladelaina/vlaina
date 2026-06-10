export interface ContentRange {
  start: number;
  end: number;
}

interface HtmlTagStart {
  closing: boolean;
  name: string;
}

const MARKDOWN_ESCAPABLE_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);
const HTML_RAW_TEXT_TAGS = new Set([
  'pre',
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'math',
  'noscript',
  'svg',
]);
const SANITIZER_DROPPED_RAW_HTML_TAGS = new Set([
  'math',
  'noscript',
  'svg',
]);

function isEscapedMarkdownPunctuation(content: string, offset: number, lowerBound: number): boolean {
  const char = content[offset];
  if (!char || !MARKDOWN_ESCAPABLE_PUNCTUATION.has(char)) {
    return false;
  }

  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= lowerBound && content[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

export function findHtmlTagEnd(content: string, start: number, end: number): number {
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
    if (char === ">") {
      return cursor + 1;
    }
  }

  return -1;
}

function findHtmlCommentEnd(content: string, start: number, end: number): number {
  const close = content.indexOf("-->", start + 4);
  return close === -1 || close + 3 > end ? end : close + 3;
}

function findHtmlCdataEnd(content: string, start: number, end: number): number {
  const close = content.indexOf("]]>", start + 9);
  return close === -1 || close + 3 > end ? end : close + 3;
}

function findHtmlProcessingInstructionEnd(content: string, start: number, end: number): number {
  const close = content.indexOf("?>", start + 2);
  return close === -1 || close + 2 > end ? end : close + 2;
}

function findHtmlDeclarationEnd(content: string, start: number, end: number): number {
  const close = content.indexOf(">", start + 2);
  return close === -1 || close + 1 > end ? end : close + 1;
}

function findHtmlNonTagEnd(content: string, start: number, end: number): number | null {
  if (content.startsWith("<!--", start)) return findHtmlCommentEnd(content, start, end);
  if (content.startsWith("<![CDATA[", start)) return findHtmlCdataEnd(content, start, end);
  if (content.startsWith("<?", start)) return findHtmlProcessingInstructionEnd(content, start, end);
  if (content.startsWith("<!", start)) return findHtmlDeclarationEnd(content, start, end);
  return null;
}

function isAsciiAlpha(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
}

function isHtmlNameChar(char: string | undefined): boolean {
  if (char === undefined) {
    return false;
  }
  return isAsciiAlpha(char) || (char >= "0" && char <= "9") || char === ":" || char === "-";
}

function readHtmlTagStart(content: string, start: number, end: number): HtmlTagStart | null {
  let cursor = start + 1;
  const closing = content[cursor] === "/";
  if (closing) {
    cursor += 1;
  }
  if (cursor >= end || !isAsciiAlpha(content[cursor])) {
    return null;
  }

  const nameStart = cursor;
  cursor += 1;
  while (cursor < end && isHtmlNameChar(content[cursor])) {
    cursor += 1;
  }

  const next = content[cursor];
  if (next !== undefined && !/\s/.test(next) && next !== "/" && next !== ">") {
    return null;
  }
  return {
    closing,
    name: content.slice(nameStart, cursor).toLowerCase(),
  };
}

function isSelfClosingTag(content: string, start: number, end: number): boolean {
  return /\/\s*>$/.test(content.slice(start, end));
}

function scanRawTextContainerEnd(content: string, tagName: string, start: number, end: number): number | null {
  let cursor = start;
  let depth = 1;

  while (cursor < end) {
    const nextTagStart = content.indexOf("<", cursor);
    if (nextTagStart === -1 || nextTagStart >= end) {
      return null;
    }

    const tagStart = readHtmlTagStart(content, nextTagStart, end);
    if (!tagStart) {
      cursor = findHtmlNonTagEnd(content, nextTagStart, end) ?? nextTagStart + 1;
      continue;
    }

    const tagEnd = findHtmlTagEnd(content, nextTagStart, end);
    if (tagEnd === -1) {
      return null;
    }

    if (tagStart.name === tagName) {
      if (tagStart.closing) {
        depth -= 1;
        if (depth <= 0) {
          return tagEnd;
        }
      } else if (!isSelfClosingTag(content, nextTagStart, tagEnd)) {
        depth += 1;
      }
    }
    cursor = tagEnd;
  }

  return null;
}

export function getHtmlTagRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return [];
  }

  const ranges: ContentRange[] = [];
  let cursor = range.start;

  while (cursor < range.end) {
    const start = content.indexOf("<", cursor);
    if (start === -1 || start >= range.end) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start, range.start)) {
      cursor = start + 1;
      continue;
    }

    const nonTagEnd = findHtmlNonTagEnd(content, start, range.end);
    if (nonTagEnd !== null) {
      cursor = nonTagEnd;
      continue;
    }
    if (!readHtmlTagStart(content, start, range.end)) {
      cursor = start + 1;
      continue;
    }

    const end = findHtmlTagEnd(content, start, range.end);
    if (end === -1) {
      break;
    }
    ranges.push({ start, end });
    if (ranges.length >= rangeLimit) {
      break;
    }
    cursor = end;
  }

  return ranges;
}

function getRawTextHtmlRangesForTags(
  content: string,
  range: ContentRange,
  tagNames: ReadonlySet<string>,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  const rangeLimit = Number.isFinite(maxRanges)
    ? Math.max(0, Math.floor(maxRanges))
    : maxRanges === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
  if (rangeLimit <= 0) {
    return [];
  }

  const ranges: ContentRange[] = [];
  let cursor = range.start;

  while (cursor < range.end) {
    const nextTagStart = content.indexOf("<", cursor);
    if (nextTagStart === -1 || nextTagStart >= range.end) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, nextTagStart, range.start)) {
      cursor = nextTagStart + 1;
      continue;
    }

    const tagStart = readHtmlTagStart(content, nextTagStart, range.end);
    if (!tagStart) {
      cursor = findHtmlNonTagEnd(content, nextTagStart, range.end) ?? nextTagStart + 1;
      continue;
    }

    const tagEnd = findHtmlTagEnd(content, nextTagStart, range.end);
    if (tagEnd === -1) {
      if (tagNames.has(tagStart.name) && !tagStart.closing) {
        ranges.push({ start: nextTagStart, end: range.end });
      }
      break;
    }
    if (tagStart.closing || !tagNames.has(tagStart.name)) {
      cursor = tagEnd;
      continue;
    }
    if (tagStart.name === "plaintext") {
      ranges.push({ start: nextTagStart, end: range.end });
      break;
    }

    const closeEnd = isSelfClosingTag(content, nextTagStart, tagEnd)
      ? tagEnd
      : scanRawTextContainerEnd(content, tagStart.name, tagEnd, range.end) ?? range.end;
    ranges.push({ start: nextTagStart, end: closeEnd });
    if (ranges.length >= rangeLimit) {
      break;
    }
    cursor = closeEnd;
  }

  return ranges;
}

export function getRawTextHtmlRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  return getRawTextHtmlRangesForTags(content, range, HTML_RAW_TEXT_TAGS, maxRanges);
}

export function getSanitizerDroppedRawHtmlRanges(
  content: string,
  range: ContentRange,
  maxRanges = Number.POSITIVE_INFINITY,
): ContentRange[] {
  return getRawTextHtmlRangesForTags(content, range, SANITIZER_DROPPED_RAW_HTML_TAGS, maxRanges);
}
