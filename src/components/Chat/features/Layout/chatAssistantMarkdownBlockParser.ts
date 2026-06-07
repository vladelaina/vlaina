import {
  buildMarkdownTextBlock,
  type MarkdownMeasurementBlock,
  type TextBlockVariant,
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
import { setCacheEntry, touchCacheEntry } from './chatLayoutCache';
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
const MAX_LAYOUT_VIDEO_IMAGE_TOKENS = 2000;
const CARRIAGE_RETURN_CODE = 13;
const LINE_FEED_CODE = 10;
const HEADING_MEASUREMENTS: Array<{ lineHeight: number; variant: TextBlockVariant }> = [
  { variant: 'heading-1', lineHeight: MARKDOWN_HEADING_ONE_LINE_HEIGHT },
  { variant: 'heading-2', lineHeight: MARKDOWN_HEADING_TWO_LINE_HEIGHT },
  { variant: 'heading-3', lineHeight: MARKDOWN_HEADING_THREE_LINE_HEIGHT },
  { variant: 'heading-4', lineHeight: MARKDOWN_HEADING_FOUR_LINE_HEIGHT },
  { variant: 'heading-5', lineHeight: MARKDOWN_HEADING_FIVE_LINE_HEIGHT },
  { variant: 'heading-6', lineHeight: MARKDOWN_HEADING_SIX_LINE_HEIGHT },
];

const parsedMarkdownBlocksCache = new Map<string, MarkdownMeasurementBlock[]>();

export { getMarkdownFenceState, isMarkdownFenceClose, type MarkdownFenceState };

function getHeadingMeasurement(depth: number): { lineHeight: number; variant: TextBlockVariant } {
  return HEADING_MEASUREMENTS[depth - 1] ?? HEADING_MEASUREMENTS[5]!;
}

function readNormalizedMarkdownLine(markdown: string, offset: number): { line: string; nextOffset: number } | null {
  const length = markdown.length;
  if (offset > length) {
    return null;
  }
  if (offset === length) {
    const lastCode = markdown.charCodeAt(length - 1);
    return lastCode === LINE_FEED_CODE || lastCode === CARRIAGE_RETURN_CODE
      ? { line: '', nextOffset: length + 1 }
      : null;
  }

  for (let index = offset; index < length; index += 1) {
    const code = markdown.charCodeAt(index);
    if (code === LINE_FEED_CODE || code === CARRIAGE_RETURN_CODE) {
      return {
        line: markdown.slice(offset, index),
        nextOffset: code === CARRIAGE_RETURN_CODE && markdown.charCodeAt(index + 1) === LINE_FEED_CODE
          ? index + 2
          : index + 1,
      };
    }
  }

  return {
    line: markdown.slice(offset),
    nextOffset: length,
  };
}

function collectSectionLines(markdown: string, startOffset: number): { endOffset: number; lines: string[] } {
  const sectionLines: string[] = [];
  let offset = startOffset;

  while (true) {
    const current = readNormalizedMarkdownLine(markdown, offset);
    if (!current) {
      break;
    }

    const line = current.line;
    if (!line.trim()) {
      break;
    }
    if (offset !== startOffset && (getMarkdownFenceState(line) || HEADING_RE.test(line) || HR_RE.test(line))) {
      break;
    }

    sectionLines.push(line);
    offset = current.nextOffset;
  }

  return { endOffset: offset, lines: sectionLines };
}

function getVideoImageTokens(markdown: string): ImageToken[] {
  return parseMarkdownAndHtmlImageTokens(markdown, { maxTokens: MAX_LAYOUT_VIDEO_IMAGE_TOKENS }).filter((token) => {
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

  const blocks: MarkdownMeasurementBlock[] = [];
  let offset = 0;

  while (true) {
    const current = readNormalizedMarkdownLine(markdown, offset);
    if (!current) {
      break;
    }

    const line = current.line;
    if (!line.trim()) {
      offset = current.nextOffset;
      continue;
    }

    const fence = getMarkdownFenceState(line);
    if (fence) {
      const codeLines: string[] = [];
      offset = current.nextOffset;

      while (true) {
        const codeLine = readNormalizedMarkdownLine(markdown, offset);
        if (!codeLine) {
          break;
        }
        if (isMarkdownFenceClose(codeLine.line, fence)) {
          offset = codeLine.nextOffset;
          break;
        }
        codeLines.push(codeLine.line);
        offset = codeLine.nextOffset;
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
      offset = current.nextOffset;
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
      offset = current.nextOffset;
      continue;
    }

    const { endOffset, lines: sectionLines } = collectSectionLines(markdown, offset);
    if (sectionLines.length === 0) {
      offset = current.nextOffset;
      continue;
    }

    const sectionMarkdown = sectionLines.join('\n');
    const videoTokens = getVideoImageTokens(sectionMarkdown);
    const videoTokenCount = videoTokens.length;
    if (videoTokenCount > 0) {
      const textWithoutMedia = stripMessageImageTokens(
        stripVideoImageTokens(sectionMarkdown, videoTokens),
        { maxTokens: MAX_LAYOUT_VIDEO_IMAGE_TOKENS },
      ).trim();
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
      offset = endOffset;
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
      offset = endOffset;
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
      offset = endOffset;
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
      offset = endOffset;
      continue;
    }

    const paragraph = buildMarkdownTextBlock(sectionLines.join(' '), 'body', MARKDOWN_BODY_LINE_HEIGHT);
    if (paragraph) {
      blocks.push(paragraph);
    }
    offset = endOffset;
  }

  if (shouldCache) {
    setCacheEntry(parsedMarkdownBlocksCache, markdown, blocks, PARSED_ASSISTANT_MARKDOWN_CACHE_LIMIT);
  }
  return blocks;
}
