import {
  collectIgnoredInlineRanges,
  collectMarkdownHtmlBlockRanges,
  getRangeEndAtOffset,
  isEscapedMarkdownPunctuation,
  isOffsetInRanges,
  normalizeContentRanges,
  type ContentRange,
} from './noteExportMarkdownRanges';
import {
  collectHtmlTagRanges,
  findHtmlImageSourceTokens,
  type HtmlTagRangeScan,
} from './noteExportMarkdownHtmlTokens';
import { decodeMarkdownHtmlText } from '@/lib/notes/markdown/markdownHtmlText';
import { getNonExcludedContentRanges } from '@/lib/markdown/contentRangeExclusion';
import type { ExportMarkdownAssetSourceToken } from './noteExportMarkdownAssetTypes';

const MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g;

interface MarkdownImageSourceMatch {
  token: ExportMarkdownAssetSourceToken;
  imageRange: ContentRange;
}

interface ParsedMarkdownImageTarget extends ExportMarkdownAssetSourceToken {
  tokenEnd: number;
}

export interface ExportMarkdownAssetTokenOptions {
  maxTokens?: number;
}

export const MAX_EXPORT_MARKDOWN_ASSET_TOKENS = 2000;
export const MAX_EXPORT_HTML_TAG_SCAN_RANGES = 8000;
export const MAX_EXPORT_IGNORED_INLINE_RANGES = 8000;
export const MAX_EXPORT_MARKDOWN_HTML_BLOCK_RANGES = 4000;
export const MAX_EXPORT_MARKDOWN_IMAGE_PART_SCAN_CHARS = 1024 * 1024;

function getMaxTokens(options?: ExportMarkdownAssetTokenOptions): number {
  const value = options?.maxTokens;
  if (value === undefined) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(value)) return value === Number.POSITIVE_INFINITY ? value : 0;
  return Math.max(0, Math.floor(value));
}

function unescapeMarkdownLinkDestination(value: string): string {
  return value.replace(MARKDOWN_LINK_DESTINATION_ESCAPE_PATTERN, '$1');
}

function normalizeMarkdownImageLookupSrc(value: string): string {
  return decodeMarkdownHtmlText(unescapeMarkdownLinkDestination(value));
}

function findMarkdownLabelEnd(
  content: string,
  start: number,
  ignoredRanges: readonly ContentRange[],
): number | null {
  let cursor = start;
  const scanEnd = Math.min(content.length, start + MAX_EXPORT_MARKDOWN_IMAGE_PART_SCAN_CHARS);
  let bracketDepth = 0;

  while (cursor < scanEnd) {
    const ignoredEnd = getRangeEndAtOffset(cursor, ignoredRanges);
    if (ignoredEnd !== null) {
      cursor = ignoredEnd;
      continue;
    }

    const char = content[cursor];
    if (char === '[' && !isEscapedMarkdownPunctuation(content, cursor)) {
      bracketDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ']' && !isEscapedMarkdownPunctuation(content, cursor)) {
      if (bracketDepth === 0) {
        return cursor;
      }
      bracketDepth -= 1;
      cursor += 1;
      continue;
    }

    cursor += 1;
  }

  return null;
}

function findMarkdownTargetClose(content: string, start: number): number | null {
  let cursor = start;
  const scanEnd = Math.min(content.length, start + MAX_EXPORT_MARKDOWN_IMAGE_PART_SCAN_CHARS);
  let quote: string | null = null;
  let parenDepth = 0;

  while (cursor < scanEnd) {
    const char = content[cursor];
    if (quote) {
      if (char === quote && !isEscapedMarkdownPunctuation(content, cursor)) {
        quote = null;
      }
      cursor += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      cursor += 1;
      continue;
    }
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      if (parenDepth === 0) {
        return cursor + 1;
      }
      parenDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function parseMarkdownImageTarget(
  content: string,
  start: number,
): ParsedMarkdownImageTarget | null {
  let cursor = start;
  const scanEnd = Math.min(content.length, start + MAX_EXPORT_MARKDOWN_IMAGE_PART_SCAN_CHARS);
  while (cursor < scanEnd && /\s/.test(content[cursor])) {
    cursor += 1;
  }
  if (cursor >= scanEnd) {
    return null;
  }

  if (content[cursor] === '<') {
    const srcStart = cursor + 1;
    let srcEnd = srcStart;
    while (
      srcEnd < scanEnd
      && content[srcEnd] !== '\n'
      && (content[srcEnd] !== '>' || isEscapedMarkdownPunctuation(content, srcEnd))
    ) {
      srcEnd += 1;
    }
    if (srcEnd >= scanEnd || content[srcEnd] !== '>') {
      return null;
    }
    const tokenEnd = findMarkdownTargetClose(content, srcEnd + 1);
    const src = content.slice(srcStart, srcEnd).trim();
    const lookupSrc = normalizeMarkdownImageLookupSrc(src);
    return tokenEnd && src ? { start: srcStart, end: srcEnd, src, lookupSrc, tokenEnd } : null;
  }

  const srcStart = cursor;
  let parenDepth = 0;
  while (cursor < scanEnd) {
    const char = content[cursor];
    if (/\s/.test(char)) {
      const tokenEnd = findMarkdownTargetClose(content, cursor);
      const src = content.slice(srcStart, cursor).trim();
      const lookupSrc = normalizeMarkdownImageLookupSrc(src);
      return tokenEnd && src ? { start: srcStart, end: cursor, src, lookupSrc, tokenEnd } : null;
    }
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '(') {
      parenDepth += 1;
      cursor += 1;
      continue;
    }
    if (char === ')') {
      if (parenDepth === 0) {
        const src = content.slice(srcStart, cursor).trim();
        const lookupSrc = normalizeMarkdownImageLookupSrc(src);
        return src ? { start: srcStart, end: cursor, src, lookupSrc, tokenEnd: cursor + 1 } : null;
      }
      parenDepth -= 1;
    }
    cursor += 1;
  }

  return null;
}

function findMarkdownImageSourceMatches(
  content: string,
  ignoredRanges: readonly ContentRange[],
  htmlTagRanges: readonly ContentRange[],
  maxTokens = Number.POSITIVE_INFINITY,
): MarkdownImageSourceMatch[] {
  const matches: MarkdownImageSourceMatch[] = [];
  let cursor = 0;

  while (cursor < content.length && matches.length < maxTokens) {
    const imageStart = content.indexOf('![', cursor);
    if (imageStart === -1) {
      break;
    }
    if (
      isOffsetInRanges(imageStart, ignoredRanges) ||
      isOffsetInRanges(imageStart, htmlTagRanges) ||
      isEscapedMarkdownPunctuation(content, imageStart)
    ) {
      cursor = imageStart + 2;
      continue;
    }

    const labelEnd = findMarkdownLabelEnd(content, imageStart + 2, ignoredRanges);
    if (labelEnd === null || content[labelEnd + 1] !== '(') {
      cursor = imageStart + 2;
      continue;
    }

    const parsed = parseMarkdownImageTarget(content, labelEnd + 2);
    if (!parsed) {
      cursor = labelEnd + 2;
      continue;
    }
    const { tokenEnd, ...token } = parsed;
    matches.push({ token, imageRange: { start: imageStart, end: tokenEnd } });
    cursor = tokenEnd;
  }

  return matches;
}

function collectVisibleHtmlTagRanges(
  content: string,
  ignoredRanges: readonly ContentRange[],
  maxRanges: number,
): HtmlTagRangeScan {
  const ranges: ContentRange[] = [];
  const visibleRanges = getNonExcludedContentRanges({ start: 0, end: content.length }, ignoredRanges);

  for (const visibleRange of visibleRanges) {
    const scan = collectHtmlTagRanges(content, maxRanges - ranges.length, visibleRange);
    ranges.push(...scan.ranges);
    if (scan.exhaustedAt !== null) {
      return { ranges, exhaustedAt: scan.exhaustedAt };
    }
  }

  return { ranges, exhaustedAt: null };
}

export function findExportMarkdownAssetSourceTokens(content: string): ExportMarkdownAssetSourceToken[] {
  return findExportMarkdownAssetSourceTokensWithOptions(content);
}

export function findExportMarkdownAssetSourceTokensWithOptions(
  content: string,
  options?: ExportMarkdownAssetTokenOptions,
): ExportMarkdownAssetSourceToken[] {
  const maxTokens = getMaxTokens(options);
  if (maxTokens <= 0) {
    return [];
  }

  const ignoredInlineScan = collectIgnoredInlineRanges(
    content,
    Number.isFinite(maxTokens) ? MAX_EXPORT_IGNORED_INLINE_RANGES : Number.POSITIVE_INFINITY,
  );
  const ignoredRanges = ignoredInlineScan.exhaustedAt === null
    ? ignoredInlineScan.ranges
    : normalizeContentRanges([
        ...ignoredInlineScan.ranges,
        { start: ignoredInlineScan.exhaustedAt, end: content.length },
      ]);
  const htmlBlockScan = collectMarkdownHtmlBlockRanges(
    content,
    Number.isFinite(maxTokens) ? MAX_EXPORT_MARKDOWN_HTML_BLOCK_RANGES : Number.POSITIVE_INFINITY,
  );
  const htmlBlockRemainderRanges = htmlBlockScan.exhaustedAt === null
    ? []
    : [{ start: htmlBlockScan.exhaustedAt, end: content.length }];
  const ignoredHtmlRanges = normalizeContentRanges([
    ...ignoredRanges,
    ...htmlBlockRemainderRanges,
  ]);
  const htmlTagScan = collectVisibleHtmlTagRanges(
    content,
    ignoredHtmlRanges,
    Number.isFinite(maxTokens) ? MAX_EXPORT_HTML_TAG_SCAN_RANGES : Number.POSITIVE_INFINITY,
  );
  const htmlTagRanges = htmlTagScan.ranges;
  const htmlScanRemainderRanges = htmlTagScan.exhaustedAt === null
    ? []
    : [{ start: htmlTagScan.exhaustedAt, end: content.length }];
  const ignoredMarkdownRanges = normalizeContentRanges([
    ...ignoredHtmlRanges,
    ...htmlBlockScan.ranges,
    ...htmlScanRemainderRanges,
  ]);
  const markdownMatches = findMarkdownImageSourceMatches(
    content,
    ignoredMarkdownRanges,
    htmlTagRanges,
    maxTokens,
  );
  return [
    ...markdownMatches.map((match) => match.token),
    ...findHtmlImageSourceTokens(
      content,
      normalizeContentRanges([...ignoredRanges, ...markdownMatches.map((match) => match.imageRange)]),
      htmlTagRanges,
      maxTokens,
    ),
  ].sort((left, right) => left.start - right.start).slice(0, maxTokens);
}
