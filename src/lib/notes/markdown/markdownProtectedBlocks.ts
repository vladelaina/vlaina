const FENCE_MARKER_PATTERN = /^(?: {0,3})(`{3,}|~{3,})(.*)$/;
const HTML_RAW_BLOCK_OPEN_PATTERN = /^(?: {0,3})<(pre|script|style)(?:\s|>|$)/i;
const HTML_COMMENT_OPEN_PATTERN = /^(?: {0,3})<!--/;
const HTML_PROCESSING_OPEN_PATTERN = /^(?: {0,3})<\?/;
const HTML_DECLARATION_OPEN_PATTERN = /^(?: {0,3})<![A-Z]/i;
const HTML_CDATA_OPEN_PATTERN = /^(?: {0,3})<!\[CDATA\[/;
const BLOCKQUOTE_PREFIX_PATTERN = /^(?: {0,3}>[ \t]?)*(.*)$/;
const INDENTED_CODE_LINE_PATTERN = /^(?: {4,}|\t)/;

type FenceState = { marker: string; length: number };

export function mapMarkdownOutsideProtectedBlocks(
  text: string,
  transformLine: (line: string, index: number, lines: readonly string[]) => string,
): string {
  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment, startIndex, lines) => segment
      .split('\n')
      .map((line, offset) => transformLine(line, startIndex + offset, lines))
      .join('\n')
  );
}

export function mapMarkdownOutsideProtectedSegments(
  text: string,
  transformSegment: (segment: string, startIndex: number, lines: readonly string[]) => string,
): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let segment: string[] = [];
  let segmentStartIndex = 0;
  let activeFence: FenceState | null = null;
  let activeHtmlBlock: RegExp | null = null;
  let activeIndentedCode = false;

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
    if (activeIndentedCode) {
      const content = getMarkdownBlockContent(line);
      if (isIndentedCodeBlockLine(content) || keepsIndentedCodeBlockOpen(lines, index)) {
        flushSegment(index + 1);
        output.push(line);
        return;
      }
      activeIndentedCode = false;
    }

    if (activeHtmlBlock) {
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

    const htmlBlock = getMarkdownRawHtmlBlockClosePattern(content);
    if (htmlBlock) {
      flushSegment(index + 1);
      output.push(line);
      activeHtmlBlock = htmlBlock.test(content) ? null : htmlBlock;
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
    && new RegExp(`^(?: {0,3})\\${marker}{${activeFence.length},}[\\t ]*$`).test(content);

  if (isFenceCloser) return null;
  if (!activeFence && isValidMarkdownFenceOpener(marker, info)) {
    return { marker, length: fence.length };
  }
  return activeFence;
}

function nextHtmlBlockState(line: string, activeHtmlBlock: RegExp | null): RegExp | null {
  const content = getMarkdownBlockContent(line);
  const closePattern = activeHtmlBlock ?? getMarkdownRawHtmlBlockClosePattern(content);
  if (!closePattern) return null;
  return closePattern.test(content) ? null : closePattern;
}

function getMarkdownBlockContent(line: string): string {
  return BLOCKQUOTE_PREFIX_PATTERN.exec(line)?.[1] ?? line;
}

function isIndentedCodeBlockLine(line: string): boolean {
  return INDENTED_CODE_LINE_PATTERN.test(line);
}

function canStartIndentedCodeBlock(lines: readonly string[], index: number): boolean {
  const previousLine = getMarkdownBlockContent(lines[index - 1] ?? '');
  return index === 0 || previousLine.trim() === '';
}

function keepsIndentedCodeBlockOpen(lines: readonly string[], index: number): boolean {
  const content = getMarkdownBlockContent(lines[index] ?? '');
  const next = findNextNonBlankMarkdownBlockContent(lines, index);
  return content.trim() === '' && next !== null && INDENTED_CODE_LINE_PATTERN.test(next);
}

function findNextNonBlankMarkdownBlockContent(
  lines: readonly string[],
  index: number,
): string | null {
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const content = getMarkdownBlockContent(lines[cursor] ?? '');
    if (content.trim() !== '') return content;
  }
  return null;
}

function getMarkdownRawHtmlBlockClosePattern(line: string): RegExp | null {
  const rawBlockMatch = HTML_RAW_BLOCK_OPEN_PATTERN.exec(line);
  if (rawBlockMatch) {
    return new RegExp(`</${rawBlockMatch[1]}>`, 'i');
  }
  if (HTML_COMMENT_OPEN_PATTERN.test(line)) return /-->/;
  if (HTML_PROCESSING_OPEN_PATTERN.test(line)) return /\?>/;
  if (HTML_DECLARATION_OPEN_PATTERN.test(line)) return />/;
  if (HTML_CDATA_OPEN_PATTERN.test(line)) return /\]\]>/;
  return null;
}

function isValidMarkdownFenceOpener(marker: string, info: string): boolean {
  return marker !== '`' || !info.includes('`');
}
