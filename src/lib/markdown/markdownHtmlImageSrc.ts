import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { MAX_INLINE_IMAGE_BASE64_CHARS } from './dataImagePolicy';

export interface HtmlImageSrcToken {
  src: string;
  valueStart: number;
  valueEnd: number;
}

const MAX_HTML_IMAGE_SRC_CHARS = 16 * 1024;
const MAX_HTML_IMAGE_DATA_SRC_CHARS = MAX_INLINE_IMAGE_BASE64_CHARS + 4096;
const MAX_HTML_IMAGE_TAG_PREFIX_CHARS = 16 * 1024;
const MAX_HTML_IMAGE_NON_SRC_ATTR_CHARS = 16 * 1024;
const MAX_HTML_IMAGE_DATA_SRC_PREFIX_CHARS = 128;

function normalizeHtmlImageSrc(rawSrc: string | undefined): string | null {
  if (!rawSrc || rawSrc.length > MAX_HTML_IMAGE_DATA_SRC_CHARS) {
    return null;
  }
  if (rawSrc.length > MAX_HTML_IMAGE_SRC_CHARS && !startsWithDataImageSrc(rawSrc)) {
    return null;
  }

  const trimmed = decodeMarkdownHtmlText(rawSrc).trim();
  if (trimmed.length > MAX_HTML_IMAGE_SRC_CHARS && !/^data:/i.test(trimmed)) {
    return null;
  }
  return trimmed ? trimmed : null;
}

function startsWithDataImageSrc(value: string): boolean {
  const prefix = value.trimStart().slice(0, MAX_HTML_IMAGE_DATA_SRC_PREFIX_CHARS);
  return /^data:image\//i.test(decodeMarkdownHtmlText(prefix));
}

export function parseHtmlImageSrcTokenFromTag(tag: string): HtmlImageSrcToken | null {
  const openTag = /^<img\b/i.exec(tag);
  if (!openTag) {
    return null;
  }

  let cursor = openTag[0].length;
  while (cursor < tag.length) {
    if (cursor > MAX_HTML_IMAGE_TAG_PREFIX_CHARS) {
      return null;
    }

    while (cursor < tag.length && /\s/.test(tag[cursor])) {
      cursor += 1;
    }

    const char = tag[cursor];
    if (!char || char === ">") {
      break;
    }
    if (char === "/") {
      cursor += 1;
      continue;
    }

    const nameStart = cursor;
    while (cursor < tag.length && !/[\s"'<>/=]/.test(tag[cursor])) {
      cursor += 1;
    }
    if (cursor === nameStart) {
      cursor += 1;
      continue;
    }

    const attrName = tag.slice(nameStart, cursor).toLowerCase();
    while (cursor < tag.length && /\s/.test(tag[cursor])) {
      cursor += 1;
    }
    if (tag[cursor] !== "=") {
      continue;
    }

    cursor += 1;
    while (cursor < tag.length && /\s/.test(tag[cursor])) {
      cursor += 1;
    }

    let rawValue = "";
    let valueStart = cursor;
    let valueEnd = cursor;
    const quote = tag[cursor];
    if (quote === '"' || quote === "'") {
      valueStart = cursor + 1;
      const closingQuote = tag.indexOf(quote, valueStart);
      valueEnd = closingQuote === -1 ? tag.length : closingQuote;
      rawValue = tag.slice(valueStart, valueEnd);
      cursor = closingQuote === -1 ? tag.length : closingQuote + 1;
    } else {
      valueStart = cursor;
      while (cursor < tag.length && !/[\s"'<>]/.test(tag[cursor])) {
        cursor += 1;
      }
      valueEnd = cursor;
      rawValue = tag.slice(valueStart, valueEnd);
    }

    if (attrName === "src") {
      const src = normalizeHtmlImageSrc(rawValue);
      return src ? { src, valueStart, valueEnd } : null;
    }
    if (rawValue.length > MAX_HTML_IMAGE_NON_SRC_ATTR_CHARS) {
      return null;
    }
  }

  return null;
}

export function parseHtmlImageSrcFromTag(tag: string): string | null {
  return parseHtmlImageSrcTokenFromTag(tag)?.src ?? null;
}

export function htmlImageTagHasDataImageSrc(tag: string): boolean {
  const token = parseHtmlImageSrcTokenFromTag(tag);
  if (token?.src && startsWithDataImageSrc(token.src)) {
    return true;
  }
  const rawPrefix = findHtmlImageSrcRawValuePrefix(tag);
  return rawPrefix !== null && startsWithDataImageSrc(rawPrefix);
}

function findHtmlImageSrcRawValuePrefix(tag: string): string | null {
  const openTag = /^<img\b/i.exec(tag);
  if (!openTag) {
    return null;
  }

  let cursor = openTag[0].length;
  while (cursor < tag.length) {
    if (cursor > MAX_HTML_IMAGE_TAG_PREFIX_CHARS) {
      return null;
    }

    while (cursor < tag.length && /\s/.test(tag[cursor])) {
      cursor += 1;
    }

    const char = tag[cursor];
    if (!char || char === ">") {
      break;
    }
    if (char === "/") {
      cursor += 1;
      continue;
    }

    const nameStart = cursor;
    while (cursor < tag.length && !/[\s"'<>/=]/.test(tag[cursor])) {
      cursor += 1;
    }
    if (cursor === nameStart) {
      cursor += 1;
      continue;
    }

    const attrName = tag.slice(nameStart, cursor).toLowerCase();
    while (cursor < tag.length && /\s/.test(tag[cursor])) {
      cursor += 1;
    }
    if (tag[cursor] !== "=") {
      continue;
    }

    cursor += 1;
    while (cursor < tag.length && /\s/.test(tag[cursor])) {
      cursor += 1;
    }

    const quote = tag[cursor];
    const valueStart = quote === '"' || quote === "'" ? cursor + 1 : cursor;
    if (attrName === "src") {
      return tag.slice(valueStart, valueStart + MAX_HTML_IMAGE_DATA_SRC_PREFIX_CHARS);
    }

    if (quote === '"' || quote === "'") {
      const closingQuote = tag.indexOf(quote, valueStart);
      const valueEnd = closingQuote === -1 ? tag.length : closingQuote;
      if (valueEnd - valueStart > MAX_HTML_IMAGE_NON_SRC_ATTR_CHARS) {
        return null;
      }
      cursor = closingQuote === -1 ? tag.length : closingQuote + 1;
      continue;
    }

    while (cursor < tag.length && !/[\s"'<>]/.test(tag[cursor])) {
      cursor += 1;
    }
    if (cursor - valueStart > MAX_HTML_IMAGE_NON_SRC_ATTR_CHARS) {
      return null;
    }
  }

  return null;
}
