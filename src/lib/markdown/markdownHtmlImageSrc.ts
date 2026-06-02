import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';

function normalizeHtmlImageSrc(rawSrc: string | undefined): string | null {
  const trimmed = rawSrc ? decodeMarkdownHtmlText(rawSrc).trim() : undefined;
  return trimmed ? trimmed : null;
}

export function parseHtmlImageSrcFromTag(tag: string): string | null {
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
    const quote = tag[cursor];
    if (quote === '"' || quote === "'") {
      const valueStart = cursor + 1;
      const valueEnd = tag.indexOf(quote, valueStart);
      rawValue = tag.slice(valueStart, valueEnd === -1 ? tag.length : valueEnd);
      cursor = valueEnd === -1 ? tag.length : valueEnd + 1;
    } else {
      const valueStart = cursor;
      while (cursor < tag.length && !/[\s"'<>]/.test(tag[cursor])) {
        cursor += 1;
      }
      rawValue = tag.slice(valueStart, cursor);
    }

    if (attrName === "src") {
      return normalizeHtmlImageSrc(rawValue);
    }
  }

  return null;
}
