import { MAX_INLINE_IMAGE_BASE64_CHARS } from './dataImagePolicy';

export interface HtmlTagStart {
  closing: boolean;
  name: string;
  overlongName?: boolean;
}

export const MAX_HTML_TAG_END_SCAN_CHARS = 64 * 1024;
const MAX_HTML_IMAGE_TAG_END_SCAN_CHARS = MAX_INLINE_IMAGE_BASE64_CHARS + 4096;
const MAX_HTML_TAG_NAME_CHARS = 128;

const MARKDOWN_ESCAPABLE_PUNCTUATION = new Set(
  Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')
);

export function isEscapedMarkdownPunctuation(content: string, offset: number, lowerBound: number): boolean {
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

export function findHtmlNonTagEnd(content: string, start: number, end: number): number | null {
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

export function readHtmlTagStart(content: string, start: number, end: number): HtmlTagStart | null {
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
    if (cursor - nameStart > MAX_HTML_TAG_NAME_CHARS) {
      return {
        closing,
        name: content.slice(nameStart, nameStart + MAX_HTML_TAG_NAME_CHARS).toLowerCase(),
        overlongName: true,
      };
    }
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

export function isSelfClosingTag(content: string, start: number, end: number): boolean {
  return /\/\s*>$/.test(content.slice(start, end));
}

export function getHtmlTagScanEnd(start: number, rangeEnd: number, tagName: string): number {
  const maxScanChars = tagName === "img"
    ? MAX_HTML_IMAGE_TAG_END_SCAN_CHARS
    : MAX_HTML_TAG_END_SCAN_CHARS;
  return Math.min(rangeEnd, start + maxScanChars + 1);
}

export function getOverflowHtmlTagProtectionEnd(content: string, start: number, rangeEnd: number): number {
  const lineFeed = content.indexOf("\n", start);
  const carriageReturn = content.indexOf("\r", start);
  const lineEnd = Math.min(
    lineFeed === -1 ? rangeEnd : lineFeed,
    carriageReturn === -1 ? rangeEnd : carriageReturn,
    rangeEnd,
  );
  return Math.min(rangeEnd, Math.max(start + 1, lineEnd));
}
