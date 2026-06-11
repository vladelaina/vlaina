import { parseMarkdownAndHtmlImageTokens } from '@/components/Chat/common/messageImageTokens';
import { normalizeRenderableDataImageSrc } from '@/components/common/markdown/imagePolicy';
import { htmlImageTagHasDataImageSrc } from '@/lib/markdown/markdownHtmlImageSrc';
import {
  findHtmlTagEnd,
  getInlineCodeRanges,
  getRangeEndAtOffset,
  iterateNonFencedContentRanges,
  type ContentRange,
} from '@/lib/markdown/markdownRanges';
import { scrubOverflowMarkdownDataImages } from '@/lib/markdown/overflowDataImageScrubber';

const INLINE_IMAGE_TOKEN_PREFIX = 'asset://localhost/chat-inline-image/';
const LARGE_DATA_IMAGE_MIN_LENGTH = 50_000;
const MAX_COMPACTED_INLINE_IMAGES = 1000;
const MAX_SCANNED_INLINE_IMAGE_TOKENS = 2000;
const MAX_EXISTING_INLINE_IMAGE_TOKENS = 2000;
const MAX_OVERFLOW_DATA_IMAGE_SCAN_CHARS = 16 * 1024 * 1024;
const MAX_OVERFLOW_HTML_IMAGE_TAG_END_SCAN_CHARS = 64 * 1024;
const MAX_OVERFLOW_INLINE_CODE_PROTECTION_RANGES = 4000;
const DATA_IMAGE_TARGET_HINT_PATTERN = /\bdata(?::|&|&#)/i;

export interface CompactedChatMarkdownImages {
  markdown: string;
  imageSrcByToken: Map<string, string>;
  replaced: number;
}

function normalizeCompactableImageSrc(src: string): string | null {
  if (src.length < LARGE_DATA_IMAGE_MIN_LENGTH) {
    return null;
  }
  return normalizeRenderableDataImageSrc(src);
}

function createToken(index: number): string {
  return `${INLINE_IMAGE_TOKEN_PREFIX}${index}`;
}

function getExistingInlineImageTokens(markdown: string): Set<string> {
  const tokens = new Set<string>();
  const pattern = /asset:\/\/localhost\/chat-inline-image\/\d+/g;
  let match: RegExpExecArray | null;
  while (tokens.size < MAX_EXISTING_INLINE_IMAGE_TOKENS && (match = pattern.exec(markdown)) !== null) {
    tokens.add(match[0]);
  }
  return tokens;
}

function createAvailableToken(index: number, unavailableTokens: Set<string>): { token: string; nextIndex: number } {
  let nextIndex = index;
  let token = createToken(nextIndex);
  while (unavailableTokens.has(token)) {
    nextIndex += 1;
    token = createToken(nextIndex);
  }
  unavailableTokens.add(token);
  return { token, nextIndex: nextIndex + 1 };
}

export function resolveCompactedChatImageSrc(
  src: string,
  imageSrcByToken: Map<string, string> | undefined,
): string {
  if (!src.startsWith(INLINE_IMAGE_TOKEN_PREFIX)) {
    return src;
  }
  return imageSrcByToken?.get(src) ?? src;
}

export function compactLargeDataImageMarkdown(markdown: string): CompactedChatMarkdownImages {
  if (!DATA_IMAGE_TARGET_HINT_PATTERN.test(markdown)) {
    return {
      markdown,
      imageSrcByToken: new Map(),
      replaced: 0,
    };
  }

  const imageSrcByToken = new Map<string, string>();
  const unavailableTokens = getExistingInlineImageTokens(markdown);
  let tokenIndex = 0;
  let replaced = 0;
  const tokens = parseMarkdownAndHtmlImageTokens(markdown, {
    maxTokens: MAX_SCANNED_INLINE_IMAGE_TOKENS,
  });
  const parts: string[] = [];
  let cursor = 0;

  for (const imageToken of tokens) {
    if (replaced >= MAX_COMPACTED_INLINE_IMAGES) {
      break;
    }
    if (imageToken.start < cursor) {
      continue;
    }
    const src = imageToken.src ? normalizeCompactableImageSrc(imageToken.src) : null;
    if (!src) {
      continue;
    }
    if (typeof imageToken.targetStart !== 'number' || typeof imageToken.targetEnd !== 'number') {
      continue;
    }

    const tokenResult = createAvailableToken(tokenIndex, unavailableTokens);
    const token = tokenResult.token;
    tokenIndex = tokenResult.nextIndex;
    parts.push(markdown.slice(cursor, imageToken.start));
    parts.push(markdown.slice(imageToken.start, imageToken.targetStart));
    parts.push(token);
    parts.push(markdown.slice(imageToken.targetEnd, imageToken.end));
    cursor = imageToken.end;
    replaced += 1;
    imageSrcByToken.set(token, src);
  }

  parts.push(markdown.slice(cursor));
  const compactedMarkdown = replaced > 0 ? parts.join('') : markdown;

  return {
    markdown: tokens.length >= MAX_SCANNED_INLINE_IMAGE_TOKENS
      ? scrubChatInlineDataImageSyntax(compactedMarkdown)
      : compactedMarkdown,
    imageSrcByToken,
    replaced,
  };
}

export function scrubChatInlineDataImageSyntax(markdown: string): string {
  return scrubOverflowHtmlInlineDataImages(scrubOverflowMarkdownDataImages(markdown, {
    replacement: '[image]',
    maxTargetChars: MAX_OVERFLOW_DATA_IMAGE_SCAN_CHARS,
  }));
}

function scrubOverflowHtmlInlineDataImages(markdown: string): string {
  let output = '';
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(markdown)) {
    output += markdown.slice(cursor, range.start);
    output += scrubOverflowHtmlInlineDataImagesInRange(markdown, range);
    cursor = range.end;
  }

  output += markdown.slice(cursor);
  return output;
}

function scrubOverflowHtmlInlineDataImagesInRange(markdown: string, range: ContentRange): string {
  const inlineCodeRanges = getInlineCodeRanges(
    markdown,
    range,
    MAX_OVERFLOW_INLINE_CODE_PROTECTION_RANGES,
  );
  let output = '';
  let cursor = range.start;

  while (cursor < range.end) {
    const start = indexOfAsciiCaseInsensitive(markdown, '<img', cursor);
    if (start === -1 || start >= range.end) {
      output += markdown.slice(cursor, range.end);
      break;
    }

    const inlineCodeEnd = getRangeEndAtOffset(start, inlineCodeRanges);
    if (inlineCodeEnd !== null) {
      output += markdown.slice(cursor, inlineCodeEnd);
      cursor = inlineCodeEnd;
      continue;
    }

    const tagEnd = findHtmlTagEnd(
      markdown,
      start,
      Math.min(range.end, start + MAX_OVERFLOW_HTML_IMAGE_TAG_END_SCAN_CHARS + 1),
    );
    const tagIsOverflow =
      tagEnd === -1 || tagEnd > range.end || tagEnd - start > MAX_OVERFLOW_HTML_IMAGE_TAG_END_SCAN_CHARS;
    if (tagIsOverflow) {
      output += markdown.slice(cursor, start);
      output += '[image]';
      cursor = tagEnd !== -1 && tagEnd <= range.end
        ? tagEnd
        : getOverflowHtmlImageScrubEnd(markdown, start, range.end);
      continue;
    }

    const tag = markdown.slice(start, tagEnd);
    if (!htmlImageTagHasDataImageSrc(tag)) {
      output += markdown.slice(cursor, tagEnd);
      cursor = tagEnd;
      continue;
    }

    output += markdown.slice(cursor, start);
    output += '[image]';
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
