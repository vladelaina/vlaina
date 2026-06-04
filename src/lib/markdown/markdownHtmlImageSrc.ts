import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

export interface HtmlImageSrcToken {
  src: string;
  valueStart: number;
  valueEnd: number;
}

function normalizeHtmlImageSrc(rawSrc: string | undefined): string | null {
  const trimmed = rawSrc ? decodeMarkdownHtmlText(rawSrc).trim() : undefined;
  return trimmed ? trimmed : null;
}

export function parseHtmlImageSrcTokenFromTag(tag: string): HtmlImageSrcToken | null {
  const openTag = /^<img\b/i.exec(tag);
  if (!openTag) {
    return null;
  }

  let cursor = openTag[0].length;
  while (cursor < tag.length) {
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
  }

  return null;
}

export function parseHtmlImageSrcFromTag(tag: string): string | null {
  return parseHtmlImageSrcTokenFromTag(tag)?.src ?? null;
}
