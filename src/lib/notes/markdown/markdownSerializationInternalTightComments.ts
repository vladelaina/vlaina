import { getMarkdownBlockContent } from '@/lib/markdown/markdownHtmlBlockClassification';
import { mapMarkdownOutsideProtectedSegments } from './markdownProtectedBlocks';
import { containsAsciiCaseInsensitive } from './markdownSerializationAscii';
import {
  isMultiLineHtmlCommentOpenLine,
  shouldKeepHtmlCommentProtectionActive
} from './markdownSerializationInternalBlankComments';
import {
  ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN,
  DOLLAR_MATH_BLOCK_FENCE_PATTERN,
  INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN,
  INTERNAL_TIGHT_HEADING_COMMENT_PATTERN,
  MathBlockFenceStyle,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN
} from './markdownSerializationShared';

export function normalizeInternalTightHeadingComments(text: string): string {
  const afterMathBlockArtifacts = normalizeInternalArtifactCommentsInsideMathBlocks(text);
  if (!containsAsciiCaseInsensitive(afterMathBlockArtifacts, 'vlaina-markdown-tight-heading')) {
    return afterMathBlockArtifacts;
  }

  return mapMarkdownOutsideProtectedSegments(
    afterMathBlockArtifacts,
    (segment) => normalizeInternalTightHeadingCommentSegment(segment),
    { protectHtmlComments: false },
  );
}

export function normalizeInternalArtifactCommentsInsideMathBlocks(text: string): string {
  if (
    !containsAsciiCaseInsensitive(text, 'vlaina-markdown-blank-line')
    && !containsAsciiCaseInsensitive(text, 'vlaina-rendered-html-boundary-blank-line')
    && !containsAsciiCaseInsensitive(text, 'vlaina-markdown-tight-heading')
  ) {
    return text;
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  let mathStyle: MathBlockFenceStyle | null = null;
  let mathContent: string[] = [];
  let changed = false;

  const flushMathContent = () => {
    const normalizedContent = normalizeInternalArtifactMathContentLines(mathContent);
    if (normalizedContent !== mathContent) {
      changed = true;
    }
    output.push(...normalizedContent);
    mathContent = [];
  };

  for (const line of lines) {
    if (mathStyle) {
      if (isMathBlockFenceCloseLine(line, mathStyle)) {
        flushMathContent();
        output.push(line);
        mathStyle = null;
        continue;
      }

      mathContent.push(line);
      continue;
    }

    const nextMathStyle = getMathBlockFenceOpenStyle(line);
    if (nextMathStyle) {
      output.push(line);
      mathStyle = nextMathStyle;
      continue;
    }

    output.push(line);
  }

  if (mathStyle) {
    flushMathContent();
  }

  return changed ? output.join('\n') : text;
}

export function normalizeInternalArtifactMathContentLines(lines: string[]): string[] {
  let changed = false;
  const output = lines.map((line) => {
    if (
      INTERNAL_MARKDOWN_BLANK_LINE_COMMENT_PATTERN.test(line)
      || RENDERED_HTML_BOUNDARY_BLANK_LINE_COMMENT_PATTERN.test(line)
      || INTERNAL_TIGHT_HEADING_COMMENT_PATTERN.test(line)
    ) {
      changed = true;
      return '';
    }
    return line;
  });

  if (!changed) return lines;

  while (output.length > 0 && (output[0] ?? '').trim() === '') {
    output.shift();
  }
  while (output.length > 0 && (output[output.length - 1] ?? '').trim() === '') {
    output.pop();
  }

  return output;
}

export function getMathBlockFenceOpenStyle(line: string): MathBlockFenceStyle | null {
  const content = getMarkdownBlockContent(line);
  if (DOLLAR_MATH_BLOCK_FENCE_PATTERN.test(content)) return 'dollar';
  if (/^(?: {0,3})\\\[\s*$/.test(content)) return 'bracket';
  return null;
}

export function isMathBlockFenceCloseLine(line: string, style: MathBlockFenceStyle): boolean {
  const content = getMarkdownBlockContent(line);
  return style === 'dollar'
    ? DOLLAR_MATH_BLOCK_FENCE_PATTERN.test(content)
    : ALTERNATIVE_MATH_BLOCK_STANDARD_CLOSE_PATTERN.test(content);
}

export function normalizeInternalTightHeadingCommentSegment(segment: string): string {
  const lines = segment.split('\n');
  const output: string[] = [];
  let activeHtmlComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (activeHtmlComment || isMultiLineHtmlCommentOpenLine(line)) {
      output.push(line);
      activeHtmlComment = shouldKeepHtmlCommentProtectionActive(activeHtmlComment, line);
      continue;
    }

    if (!INTERNAL_TIGHT_HEADING_COMMENT_PATTERN.test(line)) {
      output.push(line);
      continue;
    }

    while (output.length > 0 && output[output.length - 1]?.trim() === '') {
      output.pop();
    }

    while (index + 1 < lines.length && (lines[index + 1] ?? '').trim() === '') {
      index += 1;
    }
  }

  return output.join('\n');
}
