import {
  getMarkdownBlockContent,
  getMarkdownHtmlBlockClosePattern,
} from '@/lib/markdown/markdownHtmlBlockClassification';
import { getHtmlTagRanges } from '@/lib/markdown/markdownHtmlRanges';

const FENCE_MARKER_PATTERN = /^(?: {0,3})(`{3,}|~{3,})(.*)$/;
const HTML_RAW_BLOCK_OPEN_PATTERN = /^(?: {0,3})<(pre|script|style|textarea|title|xmp|noembed|noframes|plaintext|math|noscript|svg)(?:\s|>|$)/i;
const INDENTED_CODE_LINE_PATTERN = /^(?: {4,}|\t)/;
const UTF8_BOM = '\uFEFF';
const FRONTMATTER_DELIMITER = '---';
const MAX_FRONTMATTER_DELIMITER_LINE_CHARS = 1024;
const MAX_FRONTMATTER_CHARS = 256 * 1024;
const MAX_FRONTMATTER_LINES = 2048;
const NEVER_CLOSE_HTML_BLOCK_PATTERN = /$a/;

type FenceState = { marker: string; length: number };
type HtmlBlockState = { closePattern: RegExp; rawTagName?: string };

interface ProtectedSegmentOptions {
  protectHtmlBlocks?: boolean;
  protectHtmlComments?: boolean;
}

export function mapMarkdownOutsideProtectedBlocks(
  text: string,
  transformLine: (line: string, index: number, lines: readonly string[]) => string,
  options?: ProtectedSegmentOptions,
): string {
  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment, startIndex, lines) => segment
      .split('\n')
      .map((line, offset) => transformLine(line, startIndex + offset, lines))
      .join('\n'),
    options,
  );
}

export function mapMarkdownOutsideProtectedSegments(
  text: string,
  transformSegment: (segment: string, startIndex: number, lines: readonly string[]) => string,
  options: ProtectedSegmentOptions = {},
): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let nextNonBlankContentByIndex: Array<string | null> | null = null;
  const frontmatterEndIndex = getLeadingFrontmatterEndIndex(lines);
  const protectHtmlBlocks = options.protectHtmlBlocks !== false;
  const output: string[] = [];
  let segment: string[] = [];
  let segmentStartIndex = 0;
  let activeFence: FenceState | null = null;
  let activeHtmlBlock: HtmlBlockState | null = null;
  let activeIndentedCode = false;
  const protectHtmlComments = options.protectHtmlComments !== false;

  const flushSegment = (nextIndex: number) => {
    if (segment.length === 0) {
      segmentStartIndex = nextIndex;
      return;
    }
    output.push(transformSegment(segment.join('\n'), segmentStartIndex, lines));
    segment = [];
    segmentStartIndex = nextIndex;
  };

  lines.forEach((line, index) => {
    if (frontmatterEndIndex !== null && index <= frontmatterEndIndex) {
      flushSegment(index + 1);
      output.push(line);
      return;
    }

    if (activeIndentedCode) {
      const content = getMarkdownBlockContent(line);
      if (
        isIndentedCodeBlockLine(content)
        || keepsIndentedCodeBlockOpen(
          content,
          (nextNonBlankContentByIndex ??= getNextNonBlankMarkdownBlockContentByIndex(lines))[index]
        )
      ) {
        flushSegment(index + 1);
        output.push(line);
        return;
      }
      activeIndentedCode = false;
    }

    if (protectHtmlBlocks && activeHtmlBlock) {
      flushSegment(index + 1);
      output.push(line);
      activeHtmlBlock = nextHtmlBlockState(line, activeHtmlBlock);
      return;
    }

    if (activeFence) {
      flushSegment(index + 1);
      output.push(line);
      activeFence = nextFenceState(line, activeFence);
      return;
    }

    const content = getMarkdownBlockContent(line);
    if (isIndentedCodeBlockLine(content) && canStartIndentedCodeBlock(lines, index)) {
      flushSegment(index + 1);
      output.push(line);
      activeIndentedCode = true;
      return;
    }

    const htmlBlock = protectHtmlBlocks
      ? getMarkdownRawHtmlBlockClosePattern(content, { protectHtmlComments })
      : null;
    if (htmlBlock) {
      flushSegment(index + 1);
      output.push(line);
      activeHtmlBlock = isHtmlBlockCloseLine(content, htmlBlock) ? null : htmlBlock;
      return;
    }

    if (FENCE_MARKER_PATTERN.test(content)) {
      flushSegment(index + 1);
      output.push(line);
      activeFence = nextFenceState(line, null);
      return;
    }

    if (segment.length === 0) {
      segmentStartIndex = index;
    }
    segment.push(line);
  });

  flushSegment(lines.length);
  return output.join('\n');
}

function nextFenceState(line: string, activeFence: FenceState | null): FenceState | null {
  const content = getMarkdownBlockContent(line);
  const fenceMatch = FENCE_MARKER_PATTERN.exec(content);
  if (!fenceMatch) return activeFence;

  const fence = fenceMatch[1] ?? '';
  const marker = fence[0] ?? '';
  const info = fenceMatch[2] ?? '';
  const isFenceCloser =
    activeFence?.marker === marker
    && fence.length >= activeFence.length
    && isFenceClosingLine(content, marker, activeFence.length);

  if (isFenceCloser) return null;
  if (!activeFence && isValidMarkdownFenceOpener(marker, info)) {
    return { marker, length: fence.length };
  }
  return activeFence;
}

function isFenceClosingLine(content: string, marker: string, minimumLength: number): boolean {
  let index = 0;
  while (index < content.length && index <= 3 && content[index] === ' ') {
    index += 1;
  }
  if (index > 3) return false;

  let markerLength = 0;
  while (content[index + markerLength] === marker) {
    markerLength += 1;
  }
  if (markerLength < minimumLength) return false;

  for (let cursor = index + markerLength; cursor < content.length; cursor += 1) {
    const character = content[cursor];
    if (character !== ' ' && character !== '\t') return false;
  }
  return true;
}

function nextHtmlBlockState(line: string, activeHtmlBlock: HtmlBlockState | null): HtmlBlockState | null {
  const content = getMarkdownBlockContent(line);
  const closePattern = activeHtmlBlock ?? getMarkdownRawHtmlBlockClosePattern(content);
  if (!closePattern) return null;
  return isHtmlBlockCloseLine(content, closePattern) ? null : closePattern;
}

function getLeadingFrontmatterEndIndex(lines: readonly string[]): number | null {
  if (!isFrontmatterDelimiterLine(lines[0] ?? '', { allowLeadingBom: true })) {
    return null;
  }

  let frontmatterChars = 0;
  let frontmatterLines = 0;

  for (let index = 1; index < lines.length; index += 1) {
    if (frontmatterLines >= MAX_FRONTMATTER_LINES) {
      return null;
    }

    const line = lines[index] ?? '';
    frontmatterChars += line.length + 1;
    if (frontmatterChars > MAX_FRONTMATTER_CHARS) {
      return null;
    }

    if (isFrontmatterDelimiterLine(line)) {
      return index;
    }

    frontmatterLines += 1;
  }

  return null;
}

function isFrontmatterDelimiterLine(
  line: string,
  options: { allowLeadingBom?: boolean } = {},
): boolean {
  const candidate = options.allowLeadingBom && line.startsWith(UTF8_BOM) ? line.slice(1) : line;
  return candidate.length <= MAX_FRONTMATTER_DELIMITER_LINE_CHARS && candidate.trim() === FRONTMATTER_DELIMITER;
}

function isIndentedCodeBlockLine(line: string): boolean {
  return INDENTED_CODE_LINE_PATTERN.test(line);
}

function canStartIndentedCodeBlock(lines: readonly string[], index: number): boolean {
  const previousLine = getMarkdownBlockContent(lines[index - 1] ?? '');
  return index === 0 || previousLine.trim() === '';
}

function keepsIndentedCodeBlockOpen(content: string, next: string | null | undefined): boolean {
  return content.trim() === '' && next != null && INDENTED_CODE_LINE_PATTERN.test(next);
}

function getNextNonBlankMarkdownBlockContentByIndex(lines: readonly string[]): Array<string | null> {
  const nextNonBlankContentByIndex = Array<string | null>(lines.length).fill(null);
  let nextNonBlankContent: string | null = null;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    nextNonBlankContentByIndex[index] = nextNonBlankContent;
    const content = getMarkdownBlockContent(lines[index] ?? '');
    if (content.trim() !== '') {
      nextNonBlankContent = content;
    }
  }

  return nextNonBlankContentByIndex;
}

function getMarkdownRawHtmlBlockClosePattern(
  line: string,
  options: { protectHtmlComments?: boolean } = {},
): HtmlBlockState | null {
  const rawBlockMatch = HTML_RAW_BLOCK_OPEN_PATTERN.exec(line);
  if (rawBlockMatch) {
    const rawTagName = rawBlockMatch[1]?.toLowerCase() ?? '';
    if (rawTagName === 'plaintext') {
      return { closePattern: NEVER_CLOSE_HTML_BLOCK_PATTERN, rawTagName };
    }
    return {
      closePattern: new RegExp(`</${rawTagName}(?:\\s[^>]*)?>`, 'i'),
      rawTagName,
    };
  }
  const closePattern = getMarkdownHtmlBlockClosePattern(line, options);
  return closePattern === undefined ? null : { closePattern: closePattern ?? /^\s*$/ };
}

function isHtmlBlockCloseLine(line: string, state: HtmlBlockState): boolean {
  if (state.closePattern === NEVER_CLOSE_HTML_BLOCK_PATTERN) {
    return false;
  }

  if (!state.rawTagName) {
    return state.closePattern.test(line);
  }

  return getHtmlTagRanges(line, { start: 0, end: line.length }, 1024)
    .some((range) => {
      const tagNameMatch = /^<\/([A-Za-z][A-Za-z0-9:-]*)\b/i.exec(line.slice(range.start, range.end));
      return tagNameMatch?.[1]?.toLowerCase() === state.rawTagName;
    });
}

function isValidMarkdownFenceOpener(marker: string, info: string): boolean {
  return marker !== '`' || !info.includes('`');
}
