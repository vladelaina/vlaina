import { stripErrorTags } from '@/lib/ai/errorTag';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import { stripWebSearchStatusMarkup } from '@/lib/ai/webSearch/statusMarkup';
import { writeTextToClipboard } from '@/lib/clipboard';
import { getElectronBridge } from '@/lib/electron/bridge';
import { isRenderableDataImageSrc, normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { scrubOverflowMarkdownDataImages } from '@/lib/markdown/overflowDataImageScrubber';
import { htmlImageTagHasDataImageSrc } from '@/lib/markdown/markdownHtmlImageSrc';
import {
  getInlineCodeRanges,
  findHtmlTagEnd,
  iterateNonFencedContentRanges,
  getRangeEndAtOffset,
} from '@/lib/markdown/markdownRanges';
import { fetchChatImageBlob, MAX_CHAT_IMAGE_FETCH_BYTES } from './chatImageFetch';
import { resolveSafeChatImageSource } from './chatImageSourceResolution';
import {
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
  stripImageTokens,
  type ImageToken,
  type ImageTokenParseOptions,
} from './messageImageTokens';
import { isSvgImageMimeType, rasterizeSvgBlobToPngBlob } from './svgRasterize';

const MAX_COPY_IMAGE_SCAN_TOKENS = 2000;
const MAX_COPY_TEXT_IMAGE_TOKENS = 1000;
export const MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES = 2000;
export const MAX_CHAT_MESSAGE_IMAGE_SOURCES = 1000;
const MAX_COPY_OVERFLOW_MARKDOWN_IMAGE_TARGET_CHARS = 512 * 1024;
const MAX_COPY_HTML_IMAGE_TAG_CHARS = 20_000;

function normalizeImageToken(token: ImageToken): ImageToken | null {
  const src = normalizeRenderableImageSrc(token.src);
  return src ? { ...token, src } : null;
}

function normalizeImageTokens(tokens: ImageToken[]): ImageToken[] {
  return tokens
    .map(normalizeImageToken)
    .filter((token): token is ImageToken => Boolean(token));
}

function normalizeRenderedImageTokens(tokens: ImageToken[]): ImageToken[] {
  return normalizeImageTokens(tokens).filter((token) => !!token.src && isRenderedImageSource(token.src));
}

export function extractMarkdownImageSources(content: string, options?: ImageTokenParseOptions): string[] {
  return normalizeImageTokens(parseMarkdownImageTokens(content, options))
    .map((token) => token.src)
    .filter((src): src is string => !!src);
}

export function extractMessageImageSources(content: string, options?: ImageTokenParseOptions): string[] {
  const tokens = normalizeImageTokens(parseMarkdownAndHtmlImageTokens(content, options));

  return tokens.map((token) => token.src).filter((src): src is string => !!src);
}

export function isRenderedImageSource(src: string): boolean {
  return !parseVideoUrl(src);
}

export function normalizeRenderedMessageImageSources(sources: readonly string[] | undefined): string[] {
  if (!sources || sources.length === 0) {
    return [];
  }

  const normalizedSources: string[] = [];
  const entryLimit = Math.min(sources.length, MAX_CHAT_MESSAGE_IMAGE_SOURCE_ENTRIES);
  for (let index = 0; index < entryLimit && normalizedSources.length < MAX_CHAT_MESSAGE_IMAGE_SOURCES; index += 1) {
    const src = normalizeRenderableImageSrc(sources[index]);
    if (src && isRenderedImageSource(src)) {
      normalizedSources.push(src);
    }
  }
  return normalizedSources;
}

export function extractRenderedMarkdownImageSources(content: string, options?: ImageTokenParseOptions): string[] {
  return extractMarkdownImageSources(content, options).filter(isRenderedImageSource);
}

export function extractRenderedMessageImageSources(content: string, options?: ImageTokenParseOptions): string[] {
  return extractMessageImageSources(content, options).filter(isRenderedImageSource);
}

export function stripMarkdownImageTokens(content: string, options?: ImageTokenParseOptions): string {
  return stripImageTokens(content, normalizeRenderedImageTokens(parseMarkdownImageTokens(content, options)));
}

export function stripMessageImageTokens(content: string, options?: ImageTokenParseOptions): string {
  const tokens = normalizeRenderedImageTokens(parseMarkdownAndHtmlImageTokens(content, options));
  return stripImageTokens(content, tokens);
}

function getBoundedImageTokenLimit(options?: ImageTokenParseOptions): number | null {
  const value = options?.maxTokens;
  if (value === undefined || value === Number.POSITIVE_INFINITY) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function scrubOverflowCopyHtmlDataImages(content: string): string {
  let output = "";
  let cursor = 0;

  for (const range of iterateNonFencedContentRanges(content)) {
    output += content.slice(cursor, range.start);
    output += scrubOverflowCopyHtmlDataImagesInRange(content, range);
    cursor = range.end;
  }

  output += content.slice(cursor);
  return output;
}

function scrubOverflowCopyHtmlDataImagesInRange(
  content: string,
  range: { start: number; end: number },
): string {
  const inlineCodeRanges = getInlineCodeRanges(content, range);
  let output = "";
  let cursor = range.start;

  while (cursor < range.end) {
    const start = indexOfAsciiCaseInsensitive(content, "<img", cursor);
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

    const tagEnd = findHtmlTagEnd(content, start, range.end);
    const tagIsOverflow =
      tagEnd === -1 || tagEnd > range.end || tagEnd - start > MAX_COPY_HTML_IMAGE_TAG_CHARS;
    if (tagIsOverflow) {
      const scanEnd = Math.min(range.end, start + MAX_COPY_HTML_IMAGE_TAG_CHARS);
      if (htmlImageTagHasDataImageSrc(content.slice(start, scanEnd))) {
        output += content.slice(cursor, start);
        output += "[image]";
        cursor = tagEnd !== -1 && tagEnd <= range.end
          ? tagEnd
          : getOverflowHtmlImageScrubEnd(content, start, range.end);
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
    output += "[image]";
    cursor = tagEnd;
  }

  return output;
}

function scrubOverflowCopyMarkdownDataImages(content: string): string {
  return scrubOverflowMarkdownDataImages(content, {
    replacement: "[image]",
    maxTargetChars: MAX_COPY_OVERFLOW_MARKDOWN_IMAGE_TARGET_CHARS,
  });
}

function scrubOverflowCopyInlineDataImages(content: string): string {
  return scrubOverflowCopyMarkdownDataImages(scrubOverflowCopyHtmlDataImages(content));
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

export function formatMessageCopyText(content: string, options?: ImageTokenParseOptions): string {
  const normalizedContent = stripThinkingContent(stripWebSearchStatusMarkup(stripErrorTags(content)));
  const tokens = normalizeImageTokens(parseMarkdownAndHtmlImageTokens(normalizedContent, options));
  if (tokens.length === 0) {
    return normalizedContent;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    parts.push(normalizedContent.slice(cursor, token.start));
    if (token.src) {
      parts.push(isRenderableDataImageSrc(token.src) ? "[image]" : token.src);
    }
    cursor = token.end;
  }
  parts.push(normalizedContent.slice(cursor));
  const text = parts.join("");
  const tokenLimit = getBoundedImageTokenLimit(options);
  return tokenLimit !== null && tokens.length >= tokenLimit
    ? scrubOverflowCopyInlineDataImages(text)
    : text;
}

export async function copyImageSourceToClipboard(src: string): Promise<boolean> {
  try {
    const resolvedSrc = await resolveSafeChatImageSource(src, "clipboard-image");
    if (!resolvedSrc) {
      return false;
    }
    if (isRenderableDataImageSrc(resolvedSrc)) {
      const desktopClipboard = getElectronBridge()?.clipboard;
      if (desktopClipboard?.writeImage) {
        try {
          await desktopClipboard.writeImage(resolvedSrc);
          return true;
        } catch {
        }
      }
    }

    let blob = await fetchChatImageBlob(resolvedSrc);
    if (!blob) {
      return false;
    }
    if (isSvgImageMimeType(blob.type)) {
      const rasterizedBlob = await rasterizeSvgBlobToPngBlob(blob);
      if (!rasterizedBlob) {
        return false;
      }
      blob = rasterizedBlob;
    }
    if (blob.size > MAX_CHAT_IMAGE_FETCH_BYTES) {
      return false;
    }
    const ClipboardItemCtor = (window as any).ClipboardItem;
    if (ClipboardItemCtor && blob.type.startsWith("image/")) {
      const item = new ClipboardItemCtor({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      return true;
    }
  } catch {
  }
  return false;
}

export async function copyMessageContentToClipboard(content: string): Promise<boolean> {
  const imageSources = extractRenderedMessageImageSources(content, {
    maxTokens: MAX_COPY_IMAGE_SCAN_TOKENS,
  });
  if (imageSources.length > 0) {
    const copied = await copyImageSourceToClipboard(imageSources[0]);
    if (copied) {
      return true;
    }
  }

  return writeTextToClipboard(formatMessageCopyText(content, {
    maxTokens: MAX_COPY_TEXT_IMAGE_TOKENS,
  }));
}
