import { iterateNonFencedContentRanges } from './markdownRanges';
import { parseHtmlImageTokensInRange } from './markdownImageTokenHtml';
import {
  collectMarkdownImageTokensInRange,
  parseMarkdownImageTokensInRange,
} from './markdownImageTokenMarkdown';
import type { ImageToken, ImageTokenParseOptions } from './markdownImageTokenTypes';

export type { ImageToken, ImageTokenParseOptions } from './markdownImageTokenTypes';

const MAX_DEFAULT_IMAGE_TOKENS = 2000;

function getMaxTokens(options?: ImageTokenParseOptions): number {
  const value = options?.maxTokens;
  if (value === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(value)) return value === Number.POSITIVE_INFINITY ? value : 0;
  return Math.max(0, Math.floor(value));
}

const MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES = 2000;

export function parseMarkdownImageTokens(content: string, options?: ImageTokenParseOptions): ImageToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0 || !content.includes("![")) {
    return [];
  }

  const tokens: ImageToken[] = [];
  for (const range of iterateNonFencedContentRanges(content)) {
    if (tokens.length >= maxTokens) break;
    tokens.push(...parseMarkdownImageTokensInRange(content, range, maxTokens - tokens.length));
  }
  return tokens;
}

export function parseHtmlImageTokens(content: string, options?: ImageTokenParseOptions): ImageToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0 || !content.includes("<")) {
    return [];
  }

  const tokens: ImageToken[] = [];
  const mayContainMarkdownImages = content.includes("![");
  for (const range of iterateNonFencedContentRanges(content)) {
    if (tokens.length >= maxTokens) break;
    const markdownImageScan = mayContainMarkdownImages
      ? collectMarkdownImageTokensInRange(
          content,
          range,
          Number.isFinite(maxTokens)
            ? MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES + 1
            : Number.POSITIVE_INFINITY,
        )
      : { exhausted: false, tokens: [] };
    if (markdownImageScan.tokens.length > MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES || markdownImageScan.exhausted) {
      continue;
    }
    const markdownImageRanges = markdownImageScan.tokens;
    tokens.push(...parseHtmlImageTokensInRange(content, range, markdownImageRanges, maxTokens - tokens.length));
  }
  return tokens;
}

export function parseMarkdownAndHtmlImageTokens(content: string, options?: ImageTokenParseOptions): ImageToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0 || (!content.includes("![") && !content.includes("<"))) {
    return [];
  }

  const tokens: ImageToken[] = [];
  const mayContainMarkdownImages = content.includes("![");
  for (const range of iterateNonFencedContentRanges(content)) {
    if (tokens.length >= maxTokens) break;
    const remainingTokens = maxTokens - tokens.length;
    const markdownProtectionLimit = Number.isFinite(maxTokens)
      ? Math.max(remainingTokens, MAX_HTML_IMAGE_MARKDOWN_PROTECTION_RANGES + 1)
      : Number.POSITIVE_INFINITY;
    const markdownImageScan = mayContainMarkdownImages
      ? collectMarkdownImageTokensInRange(content, range, markdownProtectionLimit)
      : { exhausted: false, tokens: [] };
    const markdownImageTokens = markdownImageScan.tokens;
    const htmlImageTokens = markdownImageScan.exhausted
      ? []
      : parseHtmlImageTokensInRange(content, range, markdownImageTokens, remainingTokens);
    tokens.push(
      ...[...markdownImageTokens, ...htmlImageTokens]
        .sort((a, b) => a.start - b.start)
        .slice(0, remainingTokens)
    );
  }
  return tokens;
}

export function replaceImageTokens(content: string, tokens: ImageToken[], replacement: string): string {
  if (tokens.length === 0) {
    return content;
  }

  const sortedTokens = [...tokens]
    .filter((token) =>
      Number.isSafeInteger(token.start) &&
      Number.isSafeInteger(token.end) &&
      token.start >= 0 &&
      token.end > token.start &&
      token.start < content.length &&
      token.end <= content.length
    )
    .sort((a, b) => a.start === b.start ? a.end - b.end : a.start - b.start);
  const parts: string[] = [];
  let cursor = 0;

  for (const token of sortedTokens) {
    if (token.start < cursor) {
      continue;
    }
    parts.push(content.slice(cursor, token.start), replacement);
    cursor = token.end;
  }
  parts.push(content.slice(cursor));
  return parts.join("");
}

export function stripImageTokens(content: string, tokens: ImageToken[]): string {
  return replaceImageTokens(content, tokens, "");
}

export function replaceMarkdownImageTokens(content: string, replacement: string): string {
  return replaceImageTokens(content, parseMarkdownImageTokens(content, { maxTokens: MAX_DEFAULT_IMAGE_TOKENS }), replacement);
}

export function stripMarkdownImageTokens(content: string): string {
  return replaceMarkdownImageTokens(content, "");
}
