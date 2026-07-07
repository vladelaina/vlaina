import { getMarkdownBlockContent } from '@/lib/markdown/markdownHtmlBlockClassification';
import {
  getMarkdownRawHtmlBlockClosePattern,
  isHtmlBlockCloseLine,
  nextHtmlBlockState,
  type HtmlBlockState,
} from './markdownProtectedHtmlBlocks';
import { getLeadingFrontmatterEndIndex } from './markdownProtectedFrontmatter';

const INDENTED_CODE_LINE_PATTERN = /^(?: {4,}|\t)/;

type FenceLine = { infoStart: number; length: number; marker: string };
type FenceState = { marker: string; length: number };
type MathBlockState = { style: 'dollar' | 'bracket' };

interface ProtectedSegmentOptions {
  protectHtmlBlocks?: boolean;
  protectHtmlComments?: boolean;
  protectMathBlocks?: boolean;
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
  let activeMathBlock: MathBlockState | null = null;
  let activeIndentedCode = false;
  const protectHtmlComments = options.protectHtmlComments !== false;
  const protectMathBlocks = options.protectMathBlocks !== false;

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

    if (protectMathBlocks && activeMathBlock) {
      flushSegment(index + 1);
      output.push(line);
      activeMathBlock = nextMathBlockState(line, activeMathBlock);
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

    if (parseFenceLine(content)) {
      flushSegment(index + 1);
      output.push(line);
      activeFence = nextFenceState(line, null);
      return;
    }

    const mathBlock = protectMathBlocks ? nextMathBlockState(line, null) : null;
    if (mathBlock) {
      flushSegment(index + 1);
      output.push(line);
      activeMathBlock = mathBlock;
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

function nextMathBlockState(line: string, activeMathBlock: MathBlockState | null): MathBlockState | null {
  const content = getMarkdownBlockContent(line);

  if (activeMathBlock?.style === 'dollar') {
    return isDollarMathBlockFenceLine(content) ? null : activeMathBlock;
  }

  if (activeMathBlock?.style === 'bracket') {
    return isBracketMathBlockCloseLine(content) ? null : activeMathBlock;
  }

  if (isDollarMathBlockFenceLine(content)) {
    return { style: 'dollar' };
  }

  if (isBracketMathBlockOpenLine(content)) {
    return { style: 'bracket' };
  }

  return null;
}

function isDollarMathBlockFenceLine(content: string): boolean {
  return /^(?: {0,3})\$\$\s*$/.test(content);
}

function isBracketMathBlockOpenLine(content: string): boolean {
  return /^(?: {0,3})\\\[\s*$/.test(content);
}

function isBracketMathBlockCloseLine(content: string): boolean {
  return /^(?: {0,3})\\\]\s*$/.test(content);
}

function nextFenceState(line: string, activeFence: FenceState | null): FenceState | null {
  const content = getMarkdownBlockContent(line);
  const fence = parseFenceLine(content);
  if (!fence) return activeFence;

  const isFenceCloser =
    activeFence?.marker === fence.marker
    && fence.length >= activeFence.length
    && isFenceClosingLine(content, fence.marker, activeFence.length);

  if (isFenceCloser) return null;
  if (!activeFence && isValidMarkdownFenceOpener(content, fence)) {
    return { marker: fence.marker, length: fence.length };
  }
  return activeFence;
}

function parseFenceLine(content: string): FenceLine | null {
  let index = 0;
  while (index < content.length && index <= 3 && content[index] === ' ') {
    index += 1;
  }
  if (index > 3) return null;

  const marker = content[index];
  if (marker !== '`' && marker !== '~') return null;

  let length = 0;
  while (content[index + length] === marker) {
    length += 1;
  }
  if (length < 3) return null;

  return {
    infoStart: index + length,
    length,
    marker,
  };
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

function isValidMarkdownFenceOpener(content: string, fence: FenceLine): boolean {
  return fence.marker !== '`' || content.indexOf('`', fence.infoStart) === -1;
}
