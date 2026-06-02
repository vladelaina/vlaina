const FENCE_MARKER_PATTERN = /^(?: {0,3})(`{3,}|~{3,})(.*)$/;
const HTML_RAW_BLOCK_OPEN_PATTERN = /^(?: {0,3})<(pre|script|style|textarea)(?:\s|>|$)/i;
const HTML_BLOCK_TAG_OPEN_PATTERN =
  /^(?: {0,3})<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i;
const HTML_COMMENT_OPEN_PATTERN = /^(?: {0,3})<!--/;
const HTML_PROCESSING_OPEN_PATTERN = /^(?: {0,3})<\?/;
const HTML_DECLARATION_OPEN_PATTERN = /^(?: {0,3})<![A-Z]/i;
const HTML_CDATA_OPEN_PATTERN = /^(?: {0,3})<!\[CDATA\[/;
const BLOCKQUOTE_PREFIX_PATTERN = /^(?: {0,3}>[ \t]?)*(.*)$/;
const INDENTED_CODE_LINE_PATTERN = /^(?: {4,}|\t)/;
const FRONTMATTER_DELIMITER = '---';

type FenceState = { marker: string; length: number };

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
  const nextNonBlankContentByIndex = getNextNonBlankMarkdownBlockContentByIndex(lines);
  const frontmatterEndIndex = getLeadingFrontmatterEndIndex(lines);
  const protectHtmlBlocks = options.protectHtmlBlocks !== false;
  const output: string[] = [];
  let segment: string[] = [];
  let segmentStartIndex = 0;
  let activeFence: FenceState | null = null;
  let activeHtmlBlock: RegExp | null = null;
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
      if (isIndentedCodeBlockLine(content) || keepsIndentedCodeBlockOpen(content, nextNonBlankContentByIndex[index])) {
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

function getLeadingFrontmatterEndIndex(lines: readonly string[]): number | null {
  if ((lines[0] ?? '').trim() !== FRONTMATTER_DELIMITER) {
    return null;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if ((lines[index] ?? '').trim() === FRONTMATTER_DELIMITER) {
      return index;
    }
  }

  return null;
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
): RegExp | null {
  const rawBlockMatch = HTML_RAW_BLOCK_OPEN_PATTERN.exec(line);
  if (rawBlockMatch) {
    return new RegExp(`</${rawBlockMatch[1]}>`, 'i');
  }
  if (options.protectHtmlComments !== false && HTML_COMMENT_OPEN_PATTERN.test(line)) return /-->/;
  if (HTML_PROCESSING_OPEN_PATTERN.test(line)) return /\?>/;
  if (HTML_DECLARATION_OPEN_PATTERN.test(line)) return />/;
  if (HTML_CDATA_OPEN_PATTERN.test(line)) return /\]\]>/;
  if (HTML_BLOCK_TAG_OPEN_PATTERN.test(line)) return /^\s*$/;
  return null;
}

function isValidMarkdownFenceOpener(marker: string, info: string): boolean {
  return marker !== '`' || !info.includes('`');
}
