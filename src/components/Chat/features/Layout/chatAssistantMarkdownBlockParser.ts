import {
  buildMarkdownTextBlock,
  type MarkdownMeasurementBlock,
} from './chatAssistantMarkdownTypography';
import {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
} from '@/lib/markdown/markdownFence';
import {
  MARKDOWN_BODY_LINE_HEIGHT,
  MARKDOWN_BLOCKQUOTE_CONTENT_INSET,
  MARKDOWN_BLOCKQUOTE_LINE_HEIGHT,
  MARKDOWN_BLOCKQUOTE_PADDING_Y,
  MARKDOWN_HEADING_FIVE_LINE_HEIGHT,
  MARKDOWN_HEADING_FOUR_LINE_HEIGHT,
  MARKDOWN_HEADING_ONE_LINE_HEIGHT,
  MARKDOWN_HEADING_SIX_LINE_HEIGHT,
  MARKDOWN_HEADING_THREE_LINE_HEIGHT,
  MARKDOWN_HEADING_TWO_LINE_HEIGHT,
  MARKDOWN_LIST_CONTENT_INSET,
  MARKDOWN_LIST_ITEM_MARGIN_Y,
  MARKDOWN_LIST_MARGIN_Y,
} from '@/components/common/markdown/markdownMetrics';
import {
  setCacheEntry,
  touchCacheEntry,
} from './chatLayoutCache';
import {
  parseMarkdownAndHtmlImageTokens,
  type ImageToken,
} from '@/components/Chat/common/messageImageTokens';
import { stripMessageImageTokens } from '@/components/Chat/common/messageClipboard';
import { normalizeRenderableImageSrc } from '@/components/common/markdown/imagePolicy';
import { parseVideoUrl } from '@/lib/markdown/videoUrl';

const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*)$/;
const BLOCKQUOTE_RE = /^\s{0,3}>\s?/;
const LIST_MARKER_RE = /^\s{0,3}(?:[-+*]|\d+\.)\s+/;
const TASK_MARKER_RE = /^\s{0,3}(?:[-+*]|\d+\.)\s+\[(?: |x|X)\]\s+/;
const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;

const PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT = 200;
const MAX_CACHED_MARKDOWN_BLOCK_CHARS = 50_000;

const parsedMarkdownBlocksCache = new Map<string, MarkdownMeasurementBlock[]>();

export {
  getMarkdownFenceState,
  isMarkdownFenceClose,
  type MarkdownFenceState,
};

function getHeadingMeasurement(depth: number): {
  lineHeight: number;
  variant: 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4' | 'heading-5' | 'heading-6';
} {
  switch (depth) {
    case 1:
      return { lineHeight: MARKDOWN_HEADING_ONE_LINE_HEIGHT, variant: 'heading-1' };
    case 2:
      return { lineHeight: MARKDOWN_HEADING_TWO_LINE_HEIGHT, variant: 'heading-2' };
    case 3:
      return { lineHeight: MARKDOWN_HEADING_THREE_LINE_HEIGHT, variant: 'heading-3' };
    case 4:
      return { lineHeight: MARKDOWN_HEADING_FOUR_LINE_HEIGHT, variant: 'heading-4' };
    case 5:
      return { lineHeight: MARKDOWN_HEADING_FIVE_LINE_HEIGHT, variant: 'heading-5' };
    default:
      return { lineHeight: MARKDOWN_HEADING_SIX_LINE_HEIGHT, variant: 'heading-6' };
  }
}

function collectSectionLines(lines: string[], start: number): { end: number; lines: string[] } {
  const sectionLines: string[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      break;
    }
    if (index !== start && (getMarkdownFenceState(line) || HEADING_RE.test(line) || HR_RE.test(line))) {
      break;
    }
    sectionLines.push(line);
    index += 1;
  }

  return { end: index, lines: sectionLines };
}

function getVideoImageTokens(markdown: string): ImageToken[] {
  return parseMarkdownAndHtmlImageTokens(markdown).filter((token) => {
    const src = token.src ? normalizeRenderableImageSrc(token.src) : null;
    return !!src && !!parseVideoUrl(src);
  });
}

function stripVideoImageTokens(markdown: string, videoTokens: ImageToken[]): string {
  return videoTokens
    .reduceRight((next, token) => `${next.slice(0, token.start)}${next.slice(token.end)}`, markdown);
}

export function parseMarkdownMeasurementBlocks(markdown: string): MarkdownMeasurementBlock[] {
  const shouldCache = markdown.length <= MAX_CACHED_MARKDOWN_BLOCK_CHARS;
  if (shouldCache) {
    const cached = touchCacheEntry(parsedMarkdownBlocksCache, markdown);
    if (cached) {
      return cached;
    }
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

    const fence = getMarkdownFenceState(line);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !isMarkdownFenceClose(lines[index]!, fence)) {
        codeLines.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length && isMarkdownFenceClose(lines[index]!, fence)) {
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
      const heading = getHeadingMeasurement(depth);
      const block = buildMarkdownTextBlock(text, heading.variant, heading.lineHeight);
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

    const sectionMarkdown = sectionLines.join('\n');
    const videoTokens = getVideoImageTokens(sectionMarkdown);
    const videoTokenCount = videoTokens.length;
    if (videoTokenCount > 0) {
      const textWithoutMedia = stripMessageImageTokens(stripVideoImageTokens(sectionMarkdown, videoTokens)).trim();
      if (textWithoutMedia) {
        const block = buildMarkdownTextBlock(textWithoutMedia, 'body', MARKDOWN_BODY_LINE_HEIGHT);
        if (block) {
          blocks.push(block);
        }
      }
      for (let videoIndex = 0; videoIndex < videoTokenCount; videoIndex += 1) {
        blocks.push({
          kind: 'video',
          widthInset: 0,
        });
      }
      index = end;
      continue;
    }

    if (sectionLines.every((sectionLine) => BLOCKQUOTE_RE.test(sectionLine))) {
      const text = sectionLines
        .map((sectionLine) => sectionLine.replace(BLOCKQUOTE_RE, ''))
        .join('\n');
      const block = buildMarkdownTextBlock(
        text,
        'body',
        MARKDOWN_BLOCKQUOTE_LINE_HEIGHT,
        MARKDOWN_BLOCKQUOTE_CONTENT_INSET,
        MARKDOWN_BLOCKQUOTE_PADDING_Y,
      );
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
        kind: 'table',
        rowCount: Math.max(1, sectionLines.length - 1),
        widthInset: 0,
      });
      index = end;
      continue;
    }

    if (sectionLines.some((sectionLine) => LIST_MARKER_RE.test(sectionLine))) {
      const itemCount = sectionLines.filter((sectionLine) => LIST_MARKER_RE.test(sectionLine)).length;
      const text = sectionLines
        .map((sectionLine) =>
          sectionLine
            .replace(TASK_MARKER_RE, '')
            .replace(LIST_MARKER_RE, '')
            .trimEnd(),
        )
        .join('\n');
      const block = buildMarkdownTextBlock(
        text,
        'body',
        MARKDOWN_BODY_LINE_HEIGHT,
        MARKDOWN_LIST_CONTENT_INSET,
        MARKDOWN_LIST_MARGIN_Y + itemCount * MARKDOWN_LIST_ITEM_MARGIN_Y,
      );
      if (block) {
        blocks.push(block);
      }
      index = end;
      continue;
    }

    const paragraph = buildMarkdownTextBlock(sectionLines.join(' '), 'body', MARKDOWN_BODY_LINE_HEIGHT);
    if (paragraph) {
      blocks.push(paragraph);
    }
    index = end;
  }

  if (shouldCache) {
    setCacheEntry(parsedMarkdownBlocksCache, markdown, blocks, PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT);
  }
  return blocks;
}
