import {
  measureRichInlineStats,
  measureTextBlockHeight,
  type PreparedRichInline,
} from '@/lib/text-layout';
import {
  MARKDOWN_BODY_FONT_SIZE,
  MARKDOWN_CODE_BLOCK_HEADER_HEIGHT,
  MARKDOWN_CODE_BLOCK_PADDING_Y,
  MARKDOWN_TABLE_BORDER_Y,
  MARKDOWN_TABLE_CELL_PADDING_Y,
  MARKDOWN_TABLE_MARGIN_Y,
  MARKDOWN_TABLE_ROW_BORDER_Y,
  getMarkdownBodyFont,
  getMarkdownBodyLineHeight,
  getMarkdownFontScale,
  getMarkdownTextLineHeight,
  MARKDOWN_RULE_HEIGHT,
} from '@/components/common/markdown/markdownMetrics';
import { themeDomStyleTokens } from '@/styles/themeTokens';
import {
  getPreparedMarkdownTextBlock,
  normalizeInlineMarkdownForMeasurement,
} from './chatAssistantInlineMarkdown';
import type { TextBlockVariant } from './chatAssistantMarkdownTypes';

export type MarkdownMeasurementBlock =
  | {
      kind: 'text';
      extraHeight: number;
      prepared: PreparedRichInline;
      variant: TextBlockVariant;
      widthInset: number;
    }
  | {
      code: string;
      kind: 'code';
      widthInset: number;
    }
  | {
      kind: 'rule';
      widthInset: number;
    }
  | {
      kind: 'table';
      rowCount: number;
      widthInset: number;
    }
  | {
      kind: 'video';
      widthInset: number;
    };

export type { TextBlockVariant } from './chatAssistantMarkdownTypes';

const MARKDOWN_VIDEO_MAX_WIDTH = 720;

export function buildMarkdownTextBlock(
  text: string,
  variant: TextBlockVariant,
  widthInset: number = 0,
  extraHeight: number = 0,
): MarkdownMeasurementBlock | null {
  const normalized = normalizeInlineMarkdownForMeasurement(text);
  if (!normalized) {
    return null;
  }

  return {
    kind: 'text',
    extraHeight,
    prepared: getPreparedMarkdownTextBlock(text, variant),
    variant,
    widthInset,
  };
}

export function estimateMarkdownBlockHeight(
  block: MarkdownMeasurementBlock,
  contentWidth: number,
  fontSize: number = MARKDOWN_BODY_FONT_SIZE,
): number {
  switch (block.kind) {
    case 'text': {
      const measurementWidth = Math.max(
        1,
        (contentWidth - block.widthInset) / getMarkdownFontScale(fontSize),
      );
      return Math.max(
        measureRichInlineStats(block.prepared, measurementWidth).lineCount,
        1,
      ) * getMarkdownTextLineHeight(block.variant, fontSize) + block.extraHeight;
    }
    case 'code':
      return estimateCodeBlockHeight(block.code, fontSize);
    case 'rule':
      return MARKDOWN_RULE_HEIGHT;
    case 'table':
      return MARKDOWN_TABLE_MARGIN_Y
        + MARKDOWN_TABLE_BORDER_Y
        + block.rowCount * (getMarkdownBodyLineHeight(fontSize) + MARKDOWN_TABLE_CELL_PADDING_Y + MARKDOWN_TABLE_ROW_BORDER_Y);
    case 'video':
      return estimateVideoBlockHeight(contentWidth);
  }
}

function countCodeBlockLines(code: string): number {
  const end = code.endsWith('\n') ? code.length - 1 : code.length;
  let lineCount = 1;
  for (let index = 0; index < end; index += 1) {
    if (code[index] === '\n') {
      lineCount += 1;
    }
  }
  return lineCount;
}

export function estimateCodeBlockHeight(
  code: string,
  fontSize: number = MARKDOWN_BODY_FONT_SIZE,
): number {
  const lineCount = countCodeBlockLines(code);
  return MARKDOWN_CODE_BLOCK_HEADER_HEIGHT
    + MARKDOWN_CODE_BLOCK_PADDING_Y
    + lineCount * getMarkdownBodyLineHeight(fontSize);
}

export function estimateVideoBlockHeight(contentWidth: number): number {
  const videoWidth = Math.max(1, Math.min(contentWidth, MARKDOWN_VIDEO_MAX_WIDTH));
  return videoWidth * (themeDomStyleTokens.iframeDefaultHeight / themeDomStyleTokens.iframeDefaultWidth);
}

export function measureErrorHeight(
  text: string,
  width: number,
  fontSize: number = MARKDOWN_BODY_FONT_SIZE,
): number {
  const lineHeight = getMarkdownBodyLineHeight(fontSize);
  return measureTextBlockHeight(text, width, {
    font: getMarkdownBodyFont(fontSize),
    lineHeight,
    minHeight: lineHeight,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });
}
