import {
  parseMarkdownAndHtmlImageTokens,
  replaceImageTokens,
  type ImageToken,
} from '@/lib/markdown/markdownImageTokens';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';
import { IMAGE_PLACEHOLDER } from './prompts';
import { MAX_CURRENT_REQUEST_MESSAGE_CHARS, clipContentToBudget } from './requestContextLimits';
import { scrubOverflowHistoryHtmlImages } from './requestContextHtmlImages';
import {
  HISTORY_HTML_IMAGE_TAG_HINT_PATTERN,
  HISTORY_IMAGE_SOURCE_HINT_PATTERN,
  MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS,
  MAX_REQUEST_HISTORY_IMAGE_TOKENS,
} from './requestContextImageSources';
import { scrubOverflowHistoryMarkdownImages } from './requestContextMarkdownImages';

function shouldReplaceHistoryImageToken(token: ImageToken): boolean {
  return !token.src || !parseVideoUrl(token.src);
}

function countNeedleOccurrences(content: string, needle: string, limit: number): number {
  let count = 0;
  let cursor = 0;
  while (count <= limit) {
    const index = content.indexOf(needle, cursor);
    if (index === -1) return count;
    count += 1;
    cursor = index + needle.length;
  }
  return count;
}

function scrubOverflowHistoryImageSyntax(content: string): string {
  return scrubOverflowHistoryMarkdownImages(scrubOverflowHistoryHtmlImages(content));
}

function hasRemainingHistoryImageSyntax(content: string): boolean {
  return content.includes('![') || HISTORY_HTML_IMAGE_TAG_HINT_PATTERN.test(content);
}

function replaceHistoryImageTokens(content: string): string {
  const tokens = parseMarkdownAndHtmlImageTokens(content, {
    maxTokens: MAX_REQUEST_HISTORY_IMAGE_TOKENS,
  }).filter(shouldReplaceHistoryImageToken);
  const replaced = replaceImageTokens(content, tokens, IMAGE_PLACEHOLDER);
  if (
    tokens.length >= MAX_REQUEST_HISTORY_IMAGE_TOKENS ||
    HISTORY_IMAGE_SOURCE_HINT_PATTERN.test(replaced) ||
    hasRemainingHistoryImageSyntax(replaced) ||
    countNeedleOccurrences(content, '![', MAX_REQUEST_HISTORY_IMAGE_TOKENS) > MAX_REQUEST_HISTORY_IMAGE_TOKENS ||
    countNeedleOccurrences(content, '<', MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS) > MAX_REQUEST_HISTORY_HTML_TAG_SCAN_MARKERS
  ) {
    return scrubOverflowHistoryImageSyntax(replaced);
  }
  return replaced;
}

export function sanitizeRequestTextImageReferences(content: string): string {
  return replaceHistoryImageTokens(content);
}

export function sanitizeCurrentRequestTextContent(
  content: string,
  maxChars = MAX_CURRENT_REQUEST_MESSAGE_CHARS
): string {
  return clipContentToBudget(sanitizeRequestTextImageReferences(content), maxChars);
}
