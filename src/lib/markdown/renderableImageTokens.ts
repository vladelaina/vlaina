import { normalizeRenderableImageSrc } from './renderableImagePolicy';
import {
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
  replaceImageTokens,
  type ImageToken,
} from './markdownImageTokens';
import { parseVideoUrl } from './videoUrl';
import { MAX_INLINE_IMAGE_BASE64_CHARS } from './dataImagePolicy';

const MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS = 2000;
const MAX_OVERFLOW_DATA_IMAGE_TARGET_CHARS = MAX_INLINE_IMAGE_BASE64_CHARS + 4096;
const DATA_IMAGE_PREFIX = 'data:image/';

function normalizeImageToken(token: ImageToken): ImageToken | null {
  const src = normalizeRenderableImageSrc(token.src);
  return src ? { ...token, src } : null;
}

function normalizeImageTokens(tokens: ImageToken[]): ImageToken[] {
  return tokens
    .map(normalizeImageToken)
    .filter((token): token is ImageToken => token !== null && token.src !== null && !parseVideoUrl(token.src));
}

export function replaceRenderableMarkdownImageTokens(content: string, replacement: string): string {
  const parsedTokens = parseMarkdownImageTokens(content, { maxTokens: MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS });
  const tokens = normalizeImageTokens(parsedTokens);
  return scrubOverflowRenderableInlineDataImageSyntax(
    replaceImageTokens(content, tokens, replacement),
    parsedTokens.length,
    replacement,
    false,
  );
}

export function replaceRenderableMessageImageTokens(content: string, replacement: string): string {
  const parsedTokens = parseMarkdownAndHtmlImageTokens(content, { maxTokens: MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS });
  const tokens = normalizeImageTokens(parsedTokens);
  return scrubOverflowRenderableInlineDataImageSyntax(
    replaceImageTokens(content, tokens, replacement),
    parsedTokens.length,
    replacement,
    true,
  );
}

export function stripRenderableMarkdownImageTokens(content: string): string {
  return replaceRenderableMarkdownImageTokens(content, '');
}

function scrubOverflowRenderableInlineDataImageSyntax(
  content: string,
  tokenCount: number,
  replacement: string,
  includeHtml: boolean,
): string {
  if (tokenCount < MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS || !hasDataImageHint(content)) {
    return content;
  }

  const withoutMarkdownImages = scrubOverflowMarkdownDataImages(content, replacement);
  return includeHtml
    ? scrubOverflowHtmlDataImages(withoutMarkdownImages, replacement)
    : withoutMarkdownImages;
}

function hasDataImageHint(content: string): boolean {
  return /data:image\//i.test(content);
}

function isInlineDataImageTargetAt(content: string, targetStart: number): boolean {
  let cursor = targetStart;
  while (cursor < content.length && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  if (content[cursor] === '<') {
    cursor += 1;
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
  }
  return content.slice(cursor, cursor + DATA_IMAGE_PREFIX.length).toLowerCase() === DATA_IMAGE_PREFIX;
}

function scrubOverflowMarkdownDataImages(content: string, replacement: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < content.length) {
    const start = content.indexOf('![', cursor);
    if (start === -1) {
      output += content.slice(cursor);
      break;
    }

    const labelEnd = content.indexOf('](', start + 2);
    if (labelEnd === -1 || labelEnd - start > 512) {
      output += content.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const targetStart = labelEnd + 2;
    if (!isInlineDataImageTargetAt(content, targetStart)) {
      output += content.slice(cursor, targetStart);
      cursor = targetStart;
      continue;
    }

    const scanEnd = Math.min(content.length, targetStart + MAX_OVERFLOW_DATA_IMAGE_TARGET_CHARS);
    const targetEnd = content.indexOf(')', targetStart);
    if (targetEnd === -1 || targetEnd > scanEnd) {
      output += content.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    output += content.slice(cursor, start);
    output += replacement;
    cursor = targetEnd + 1;
  }

  return output;
}

function scrubOverflowHtmlDataImages(content: string, replacement: string): string {
  let output = '';
  let cursor = 0;

  while (cursor < content.length) {
    const start = indexOfAsciiCaseInsensitive(content, '<img', cursor);
    if (start === -1) {
      output += content.slice(cursor);
      break;
    }

    const scanEnd = Math.min(content.length, start + MAX_OVERFLOW_DATA_IMAGE_TARGET_CHARS);
    const end = content.indexOf('>', start + 4);
    if (end === -1 || end > scanEnd) {
      output += content.slice(cursor, start + 4);
      cursor = start + 4;
      continue;
    }

    const tag = content.slice(start, end + 1);
    if (!hasDataImageHint(tag)) {
      output += content.slice(cursor, end + 1);
      cursor = end + 1;
      continue;
    }

    output += content.slice(cursor, start);
    output += replacement;
    cursor = end + 1;
  }

  return output;
}

function indexOfAsciiCaseInsensitive(value: string, needle: string, fromIndex: number): number {
  const lowerNeedle = needle.toLowerCase();
  const maxStart = value.length - needle.length;
  for (let index = Math.max(0, fromIndex); index <= maxStart; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (value[index + offset]?.toLowerCase() !== lowerNeedle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return index;
    }
  }
  return -1;
}
