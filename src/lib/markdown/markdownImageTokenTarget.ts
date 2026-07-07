import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { isEscapedMarkdownPunctuation } from './markdownRanges';
import { parseMarkdownImageClosingParen } from './markdownImageTitle';

export const MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS = 1024 * 1024;

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;
const MARKDOWN_LINK_DESTINATION_ESCAPE_AT_PATTERN = /^\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/;

function getFirstMarkdownImageTargetSegment(value: string): string {
  let index = 0;
  while (index < value.length && !/\s/.test(value[index])) {
    index += 1;
  }
  return value.slice(0, index);
}

export function normalizeImageMarkdownTarget(rawTarget: string): string | null {
  const trimmed = rawTarget.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    const wrapped = decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(trimmed.slice(1, -1).trim()));
    return wrapped || null;
  }

  const firstSegment = decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(getFirstMarkdownImageTargetSegment(trimmed)));
  return firstSegment || null;
}

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

export function parseMarkdownImageTarget(
  content: string,
  targetStart: number,
  rangeEnd: number,
): { raw: string; targetStart: number; targetEnd: number; end: number } | null {
  let pos = targetStart;
  const length = Math.min(content.length, rangeEnd, targetStart + MAX_MARKDOWN_IMAGE_PART_SCAN_CHARS);

  while (pos < length && /\s/.test(content[pos])) {
    pos += 1;
  }
  if (pos >= length) {
    return null;
  }

  if (content[pos] === "<") {
    const rawStart = pos + 1;
    let closingAngle = rawStart;
    while (closingAngle < length) {
      if (content[closingAngle] === ">" && !isEscapedMarkdownPunctuation(content, closingAngle, rawStart)) {
        break;
      }
      closingAngle += 1;
    }
    if (closingAngle >= length) {
      return null;
    }

    const end = parseMarkdownImageClosingParen(content, closingAngle + 1, length);
    if (end === null) {
      return null;
    }
    return {
      raw: content.slice(pos, closingAngle + 1),
      targetStart: rawStart,
      targetEnd: closingAngle,
      end,
    };
  }

  const rawStart = pos;
  let depth = 0;
  while (pos < length) {
    const ch = content[pos];
    if (ch === "\\" && pos + 1 < length && MARKDOWN_LINK_DESTINATION_ESCAPE_AT_PATTERN.test(content.slice(pos, pos + 2))) {
      pos += 2;
      continue;
    }
    if (/\s/.test(ch)) {
      const raw = content.slice(rawStart, pos).trimEnd();
      const end = parseMarkdownImageClosingParen(content, pos, length);
      return end === null ? null : { raw, targetStart: rawStart, targetEnd: rawStart + raw.length, end };
    }
    if (ch === "(") {
      depth += 1;
      pos += 1;
      continue;
    }
    if (ch === ")") {
      if (depth === 0) {
        const raw = content.slice(rawStart, pos).trimEnd();
        return {
          raw,
          targetStart: rawStart,
          targetEnd: rawStart + raw.length,
          end: pos + 1,
        };
      }
      depth -= 1;
      pos += 1;
      continue;
    }
    pos += 1;
  }

  return null;
}
