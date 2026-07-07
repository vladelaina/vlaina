import { getMarkdownBlockContent } from '@/lib/markdown/markdownHtmlBlockClassification';
import { isMarkdownImageOnlyLine } from './markdownImageLine';
import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import { containsAsciiCaseInsensitive } from './markdownSerializationAscii';
import {
  HTML_BLOCK_LINE_PATTERN,
  HTML_CLOSING_RENDERED_BLOCK_PATTERN,
  HTML_COMMENT_CLOSE_PATTERN,
  HTML_COMMENT_OPEN_PATTERN,
  HTML_IMAGE_LINE_PATTERN,
  HTML_ONE_LINE_RENDERED_BLOCK_PATTERN, HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN,
  INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN,
  INTERNAL_TIGHT_HEADING_COMMENT_PATTERN,
  NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN
} from './markdownSerializationShared';

export function normalizeInternalMarkdownBlankLineComments(text: string): string {
  if (
    !containsAsciiCaseInsensitive(text, 'vlaina-markdown-blank-line')
    && !containsAsciiCaseInsensitive(text, 'vlaina-rendered-html-boundary-blank-line')
  ) return text;

  const afterRenderedHtmlBoundaryHelpers = normalizeRenderedHtmlBoundaryHelperComments(text);
  const shouldCollapseSingleHtmlBoundaryPlaceholder =
    hasSingleInternalBlankLineCommentAfterHtmlBoundary(afterRenderedHtmlBoundaryHelpers);
  const normalized = mapMarkdownOutsideProtectedSegments(
    afterRenderedHtmlBoundaryHelpers,
    (segment, startIndex, lines) =>
      normalizeInternalMarkdownBlankLineCommentSegment(segment, startIndex, lines),
    { protectHtmlComments: false },
  );
  return shouldCollapseSingleHtmlBoundaryPlaceholder
    ? collapseHtmlBoundaryBlankLinesCreatedByInternalComments(normalized)
    : normalized;
}

export function normalizeRenderedHtmlBoundaryHelperComments(text: string): string {
  if (!containsAsciiCaseInsensitive(text, 'vlaina-rendered-html-boundary-blank-line')) return text;

  return mapMarkdownOutsideProtectedSegments(
    text,
    (segment, startIndex, lines) =>
      normalizeRenderedHtmlBoundaryHelperCommentSegment(segment, startIndex, lines),
    { protectHtmlBlocks: false, protectHtmlComments: false },
  );
}

export function normalizeRenderedHtmlBoundaryHelperCommentSegment(
  text: string,
  startIndex: number,
  allLines: readonly string[],
): string {
  const lines = text.split('\n');
  let changed = false;
  const output: string[] = [];
  let activeHtmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (activeHtmlComment || isMultiLineHtmlCommentOpenLine(line)) {
      output.push(line);
      activeHtmlComment = shouldKeepHtmlCommentProtectionActive(activeHtmlComment, line);
      continue;
    }

    if (!RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN.test(line)) {
      output.push(line);
      continue;
    }

    const previousBoundaryLine =
      findNearestPreviousNonBlankOutputLine(output)
      ?? findNearestPreviousNonBlankInputLine(allLines, startIndex + index - 1);
    if (isRenderedHtmlBlockBoundaryLine(previousBoundaryLine)) {
      changed = true;
      const hadLocalBlankBeforeHelper = output.length > 0 && output[output.length - 1]?.trim() === '';
      const hadInputBlankBeforeHelper = (allLines[startIndex + index - 1] ?? '').trim() === '';
      while (output.length > 0 && output[output.length - 1]?.trim() === '') {
        output.pop();
      }
      if (hadLocalBlankBeforeHelper || !hadInputBlankBeforeHelper) {
        output.push('');
      }
    } else {
      output.push(line);
      continue;
    }

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return changed ? output.join('\n') : text;
}

export function hasSingleInternalBlankLineCommentAfterHtmlBoundary(text: string): boolean {
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(lines[index] ?? '')) {
      continue;
    }

    if (INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(lines[index + 1] ?? '')) {
      continue;
    }

    if ((lines[index + 1] ?? '').trim() === '') {
      continue;
    }

    const previousLine = lines[index - 1] ?? '';
    if (previousLine.trim() !== '') {
      continue;
    }

    if (isHtmlBlockBoundaryLine(findNearestPreviousNonBlankInputLine(lines, index - 1))) {
      return true;
    }
  }
  return false;
}

export function findNearestPreviousNonBlankInputLine(lines: readonly string[], startIndex: number): string | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') return line;
  }
  return null;
}

export function collapseHtmlBoundaryBlankLinesCreatedByInternalComments(text: string): string {
  if (!text.includes('\n\n\n')) return text;

  const lines = text.split('\n');
  const output: string[] = [];
  for (const line of lines) {
    if (
      line.trim() === ''
      && output.length >= 2
      && output[output.length - 1]?.trim() === ''
      && isHtmlBlockBoundaryLine(findNearestPreviousNonBlankOutputLine(output))
    ) {
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

export function findNearestPreviousNonBlankOutputLine(lines: readonly string[]): string | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() !== '') return line;
  }
  return null;
}

export function isHtmlBlockBoundaryLine(line: string | null): boolean {
  return line !== null
    && (
      HTML_BLOCK_LINE_PATTERN.test(line)
      || /^<![A-Za-z][^>]*>\s*$/.test(line)
      || /^<\?.*\?>\s*$/.test(line)
      || /^<!\[CDATA\[[\s\S]*\]\]>\s*$/.test(line)
    );
}

export function isRenderedHtmlBlockBoundaryLine(line: string | null): boolean {
  if (line === null) return false;

  const match = HTML_ONE_LINE_RENDERED_BLOCK_PATTERN.exec(line)
    ?? HTML_ONE_LINE_RENDERED_VOID_BLOCK_PATTERN.exec(line);
  const closingTagName = HTML_CLOSING_RENDERED_BLOCK_PATTERN.exec(line)?.[1]?.toLowerCase();
  const tagName = match?.[1]?.toLowerCase() ?? closingTagName ?? getHtmlStartTagName(line);
  return Boolean(tagName && !NON_EDITABLE_HTML_BOUNDARY_TAG_NAMES.has(tagName));
}

export function getHtmlStartTagName(line: string): string | null {
  const match = /^(?: {0,3})<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/.exec(line);
  return match?.[1]?.toLowerCase() ?? null;
}

export function normalizeInternalMarkdownBlankLineCommentSegment(
  segment: string,
  startIndex = 0,
  allLines: readonly string[] = segment.split('\n'),
): string {
  const lines = segment.split('\n');
  const output: string[] = [];
  let previousWasInternalBlankLine = false;
  let activeHtmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (activeHtmlComment || isMultiLineHtmlCommentOpenLine(line)) {
      output.push(line);
      activeHtmlComment = shouldKeepHtmlCommentProtectionActive(activeHtmlComment, line);
      continue;
    }

    if (!INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)) {
      output.push(line);
      if (line.trim() !== '') {
        previousWasInternalBlankLine = false;
      }
      continue;
    }

    if (
      output.length === 0
      && isDiscardableHtmlBoundaryInternalBlankLineComment(allLines, startIndex + index)
    ) {
      while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
        index += 1;
      }
      continue;
    }

    if (!previousWasInternalBlankLine && !hasStructuralBlankAfterImage(output)) {
      while (output.length > 0 && output[output.length - 1]?.trim() === '') {
        output.pop();
      }
    }

    output.push('');
    previousWasInternalBlankLine = true;

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return output.join('\n');
}

export function isDiscardableHtmlBoundaryInternalBlankLineComment(
  lines: readonly string[],
  index: number,
): boolean {
  if ((lines[index - 1] ?? '').trim() !== '') return false;

  const previous = findNearestPreviousNonBlankInputLine(lines, index - 1);
  return isHtmlBlockBoundaryLine(previous)
    && !HTML_IMAGE_LINE_PATTERN.test(previous ?? '')
    && !isMarkdownImageOnlyLine(previous);
}

export function hasStructuralBlankAfterImage(lines: readonly string[]): boolean {
  if ((lines[lines.length - 1] ?? '').trim() !== '') return false;

  for (let index = lines.length - 2; index >= 0; index -= 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') continue;
    return HTML_IMAGE_LINE_PATTERN.test(line) || isMarkdownImageOnlyLine(line);
  }

  return false;
}

export function isMultiLineHtmlCommentOpenLine(line: string): boolean {
  return isHtmlCommentOpenLine(line) && !isHtmlCommentCloseLine(line);
}

export function isHtmlCommentOpenLine(line: string): boolean {
  return HTML_COMMENT_OPEN_PATTERN.test(getMarkdownBlockContent(line));
}

export function isHtmlCommentCloseLine(line: string): boolean {
  return HTML_COMMENT_CLOSE_PATTERN.test(getMarkdownBlockContent(line));
}

export function shouldKeepHtmlCommentProtectionActive(wasActive: boolean, line: string): boolean {
  if (wasActive && isInternalEditorCommentLine(line)) {
    return true;
  }
  return !isHtmlCommentCloseLine(line);
}

export function isInternalEditorCommentLine(line: string): boolean {
  return INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)
    || RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN.test(line)
    || INTERNAL_TIGHT_HEADING_COMMENT_PATTERN.test(line);
}
