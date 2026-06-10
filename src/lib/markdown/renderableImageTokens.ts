import { normalizeRenderableImageSrc } from './renderableImagePolicy';
import {
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
  replaceImageTokens,
  type ImageToken,
} from './markdownImageTokens';
import { parseVideoUrl } from './videoUrl';
import { MAX_INLINE_IMAGE_BASE64_CHARS } from './dataImagePolicy';
import { scrubOverflowMarkdownDataImages } from './overflowDataImageScrubber';
import {
  findHtmlTagEnd,
  getInlineCodeRanges,
  getRangeEndAtOffset,
  iterateNonFencedContentRanges,
  type ContentRange,
} from './markdownRanges';
import { htmlImageTagHasDataImageSrc } from './markdownHtmlImageSrc';

const MAX_RENDERABLE_IMAGE_REPLACEMENT_TOKENS = 2000;
const MAX_OVERFLOW_DATA_IMAGE_TARGET_CHARS = MAX_INLINE_IMAGE_BASE64_CHARS + 4096;

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

  const withoutMarkdownImages = scrubOverflowMarkdownDataImages(content, {
    replacement,
    maxTargetChars: MAX_OVERFLOW_DATA_IMAGE_TARGET_CHARS,
  });
  return includeHtml
    ? scrubOverflowHtmlDataImages(withoutMarkdownImages, replacement)
    : withoutMarkdownImages;
}

function hasDataImageHint(content: string): boolean {
  return /\bdata(?::|&|&#)/i.test(content);
}

function scrubOverflowHtmlDataImages(content: string, replacement: string): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowHtmlDataImagesInRange(content, range, replacement);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowHtmlDataImagesInRange(
  content: string,
  range: ContentRange,
  replacement: string,
): string {
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  let output = '';
  let cursor = range.start;

  while (cursor < range.end) {
    const start = indexOfAsciiCaseInsensitive(content, '<img', cursor);
    if (start === -1 || start >= range.end) {
      output += content.slice(cursor, range.end);
      break;
    }

    const inlineCodeEnd = getRangeEndAtOffset(start, inlineCodeRanges);
    if (inlineCodeEnd !== null) {
      output += content.slice(cursor, inlineCodeEnd);
      cursor = inlineCodeEnd;
      continue;
    }

    const scanEnd = Math.min(range.end, start + MAX_OVERFLOW_DATA_IMAGE_TARGET_CHARS);
    const tagEnd = findHtmlTagEnd(content, start, scanEnd);
    if (tagEnd === -1) {
      if (htmlImageTagHasDataImageSrc(content.slice(start, scanEnd))) {
        output += content.slice(cursor, start);
        output += replacement;
        cursor = getOverflowHtmlImageScrubEnd(content, start, range.end);
        continue;
      }
      output += content.slice(cursor, start + 4);
      cursor = start + 4;
      continue;
    }

    const tag = content.slice(start, tagEnd);
    if (!htmlImageTagHasDataImageSrc(tag)) {
      output += content.slice(cursor, tagEnd);
      cursor = tagEnd;
      continue;
    }

    output += content.slice(cursor, start);
    output += replacement;
    cursor = tagEnd;
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

function getOverflowHtmlImageScrubEnd(content: string, start: number, rangeEnd: number): number {
  const lineFeed = content.indexOf('\n', start);
  const carriageReturn = content.indexOf('\r', start);
  return Math.min(
    lineFeed === -1 ? rangeEnd : lineFeed,
    carriageReturn === -1 ? rangeEnd : carriageReturn,
    rangeEnd,
  );
}
