export interface ContentRange {
  start: number;
  end: number;
}

const HTML_RAW_TEXT_OPEN_PATTERN = /<(script|style|textarea|title|xmp)(?:\s|>|$)/i;
const MARKDOWN_ESCAPABLE_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);

function getBacktickRunLength(content: string, start: number): number {
  let cursor = start;
  while (cursor < content.length && content[cursor] === '`') {
    cursor += 1;
  }
  return cursor - start;
}

function getInlineCodeRanges(content: string): ContentRange[] {
  const ranges: ContentRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    if (content[cursor] !== '`') {
      cursor += 1;
      continue;
    }

    const tickCount = getBacktickRunLength(content, cursor);
    let close = cursor + tickCount;
    while (close < content.length) {
      if (content[close] !== '`') {
        close += 1;
        continue;
      }
      const closeTickCount = getBacktickRunLength(content, close);
      if (closeTickCount === tickCount) {
        ranges.push({ start: cursor, end: close + tickCount });
        cursor = close + tickCount;
        break;
      }
      close += closeTickCount;
    }
    if (close >= content.length) {
      cursor += tickCount;
    }
  }

  return ranges;
}

export function isOffsetInRanges(offset: number, ranges: readonly ContentRange[]): boolean {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

export function isEscapedMarkdownPunctuation(content: string, offset: number): boolean {
  const char = content[offset];
  if (!char || !MARKDOWN_ESCAPABLE_PUNCTUATION.has(char)) {
    return false;
  }

  let backslashCount = 0;
  for (let cursor = offset - 1; cursor >= 0 && content[cursor] === '\\'; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
}

function getHtmlCommentRanges(content: string): ContentRange[] {
  const ranges: ContentRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<!--', cursor);
    if (start === -1) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start)) {
      cursor = start + 4;
      continue;
    }

    const close = content.indexOf('-->', start + 4);
    const end = close === -1 ? content.length : close + 3;
    ranges.push({ start, end });
    cursor = end;
  }

  return ranges;
}

function findHtmlTagEnd(content: string, start: number): number {
  let quote: string | null = null;

  for (let cursor = start + 1; cursor < content.length; cursor += 1) {
    const char = content[cursor];
    if (quote) {
      if (char === quote) quote = null;
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

function getRawTextHtmlRanges(content: string): ContentRange[] {
  const ranges: ContentRange[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('<', cursor);
    if (start === -1) {
      break;
    }
    if (isEscapedMarkdownPunctuation(content, start)) {
      cursor = start + 1;
      continue;
    }

    const tagEnd = findHtmlTagEnd(content, start);
    if (tagEnd === -1) {
      break;
    }

    const tag = content.slice(start, tagEnd);
    const match = HTML_RAW_TEXT_OPEN_PATTERN.exec(tag);
    if (!match) {
      cursor = tagEnd;
      continue;
    }

    const closePattern = new RegExp(`</${match[1]}>`, 'i');
    const closeMatch = closePattern.exec(content.slice(tagEnd));
    const end = closeMatch ? tagEnd + closeMatch.index + closeMatch[0].length : content.length;
    ranges.push({ start, end });
    cursor = end;
  }

  return ranges;
}

export function getIgnoredInlineRanges(markdown: string): ContentRange[] {
  return [
    ...getInlineCodeRanges(markdown),
    ...getHtmlCommentRanges(markdown),
    ...getRawTextHtmlRanges(markdown),
  ];
}
