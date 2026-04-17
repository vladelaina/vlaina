import {
  buildMarkdownTextBlock,
  type MarkdownMeasurementBlock,
} from './chatAssistantMarkdownTypography';
import {
  BODY_LINE_HEIGHT,
  HEADING_ONE_LINE_HEIGHT,
  HEADING_THREE_LINE_HEIGHT,
  HEADING_TWO_LINE_HEIGHT,
} from './chatAssistantMarkdownTheme';
import {
  setCacheEntry,
  touchCacheEntry,
} from './chatLayoutCache';

const FENCE_START_RE = /^\s*```/;
const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
const BLOCKQUOTE_RE = /^\s{0,3}>\s?/;
const LIST_MARKER_RE = /^\s{0,3}(?:[-+*]|\d+\.)\s+/;
const TASK_MARKER_RE = /^\s{0,3}(?:[-+*]|\d+\.)\s+\[(?: |x|X)\]\s+/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

const ASSISTANT_LIST_INDENT = 26;
const ASSISTANT_BLOCKQUOTE_INDENT = 18;
const PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT = 200;

const parsedMarkdownBlocksCache = new Map<string, MarkdownMeasurementBlock[]>();

function collectSectionLines(lines: string[], start: number): { end: number; lines: string[] } {
  const sectionLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      break;
    }
    if (index !== start && (FENCE_START_RE.test(line) || HEADING_RE.test(line) || HR_RE.test(line))) {
      break;
    }
    sectionLines.push(line);
    index += 1;
  }

  return { end: index, lines: sectionLines };
}

export function parseMarkdownMeasurementBlocks(markdown: string): MarkdownMeasurementBlock[] {
  const cached = touchCacheEntry(parsedMarkdownBlocksCache, markdown);
  if (cached) {
    return cached;
  }

  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownMeasurementBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (FENCE_START_RE.test(line)) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_START_RE.test(lines[index]!)) {
        codeLines.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length && FENCE_START_RE.test(lines[index]!)) {
        index += 1;
      }
      blocks.push({
        kind: 'code',
        code: codeLines.join('\n'),
        widthInset: 0,
      });
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({
        kind: 'rule',
        widthInset: 0,
      });
      index += 1;
      continue;
    }

    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      const depth = headingMatch[1]!.length;
      const text = headingMatch[2] ?? '';
      const block = buildMarkdownTextBlock(
        text,
        depth <= 1 ? 'heading-1' : depth === 2 ? 'heading-2' : 'heading-3',
        depth <= 1 ? HEADING_ONE_LINE_HEIGHT : depth === 2 ? HEADING_TWO_LINE_HEIGHT : HEADING_THREE_LINE_HEIGHT,
      );
      if (block) {
        blocks.push(block);
      }
      index += 1;
      continue;
    }

    const { end, lines: sectionLines } = collectSectionLines(lines, index);
    if (sectionLines.length === 0) {
      index = Math.max(index + 1, end);
      continue;
    }

    if (sectionLines.every((sectionLine) => BLOCKQUOTE_RE.test(sectionLine))) {
      const text = sectionLines
        .map((sectionLine) => sectionLine.replace(BLOCKQUOTE_RE, ''))
        .join('\n');
      const block = buildMarkdownTextBlock(text, 'body', BODY_LINE_HEIGHT, ASSISTANT_BLOCKQUOTE_INDENT);
      if (block) {
        blocks.push(block);
      }
      index = end;
      continue;
    }

    if (
      sectionLines.length >= 2 &&
      TABLE_ROW_RE.test(sectionLines[0]!) &&
      /^\s*\|?[:\- ]+\|[:\-| ]+\s*$/.test(sectionLines[1]!)
    ) {
      blocks.push({
        kind: 'code',
        code: sectionLines.join('\n'),
        widthInset: 0,
      });
      index = end;
      continue;
    }

    if (sectionLines.some((sectionLine) => LIST_MARKER_RE.test(sectionLine))) {
      const text = sectionLines
        .map((sectionLine) =>
          sectionLine
            .replace(TASK_MARKER_RE, '')
            .replace(LIST_MARKER_RE, '')
            .trimEnd(),
        )
        .join('\n');
      const block = buildMarkdownTextBlock(text, 'body', BODY_LINE_HEIGHT, ASSISTANT_LIST_INDENT);
      if (block) {
        blocks.push(block);
      }
      index = end;
      continue;
    }

    const paragraph = buildMarkdownTextBlock(sectionLines.join(' '), 'body', BODY_LINE_HEIGHT);
    if (paragraph) {
      blocks.push(paragraph);
    }
    index = end;
  }

  setCacheEntry(parsedMarkdownBlocksCache, markdown, blocks, PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT);
  return blocks;
}
