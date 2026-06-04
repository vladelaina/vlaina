import {
  measureRichInlineStats,
  measureTextBlockHeight,
  type PreparedRichInline,
} from '@/lib/text-layout';
import {
  MARKDOWN_BODY_FONT,
  MARKDOWN_BODY_LINE_HEIGHT,
  MARKDOWN_CODE_BLOCK_HEADER_HEIGHT,
  MARKDOWN_CODE_BLOCK_PADDING_Y,
  MARKDOWN_CODE_LINE_HEIGHT,
  MARKDOWN_TABLE_BORDER_Y,
  MARKDOWN_TABLE_CELL_PADDING_Y,
  MARKDOWN_TABLE_LINE_HEIGHT,
  MARKDOWN_TABLE_MARGIN_Y,
  MARKDOWN_TABLE_ROW_BORDER_Y,
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
      lineHeight: number;
      prepared: PreparedRichInline;
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

const ASSISTANT_ERROR_LINE_HEIGHT = MARKDOWN_BODY_LINE_HEIGHT;
const MARKDOWN_VIDEO_MAX_WIDTH = 720;

export function buildMarkdownTextBlock(
  text: string,
  variant: TextBlockVariant,
  lineHeight: number,
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
    lineHeight,
    widthInset,
  };
}

export function estimateMarkdownBlockHeight(block: MarkdownMeasurementBlock, contentWidth: number): number {
  switch (block.kind) {
    case 'text':
      return Math.max(
        measureRichInlineStats(block.prepared, Math.max(1, contentWidth - block.widthInset)).lineCount,
        1,
      ) * block.lineHeight + block.extraHeight;
    case 'code':
      return estimateCodeBlockHeight(block.code);
    case 'rule':
      return MARKDOWN_RULE_HEIGHT;
    case 'table':
      return MARKDOWN_TABLE_MARGIN_Y
        + MARKDOWN_TABLE_BORDER_Y
        + block.rowCount * (MARKDOWN_TABLE_LINE_HEIGHT + MARKDOWN_TABLE_CELL_PADDING_Y + MARKDOWN_TABLE_ROW_BORDER_Y);
    case 'video':
      return estimateVideoBlockHeight(contentWidth);
  }
}

export function estimateCodeBlockHeight(code: string): number {
  const lineCount = Math.max(code.replace(/\n$/, '').split('\n').length, 1);
  return MARKDOWN_CODE_BLOCK_HEADER_HEIGHT + MARKDOWN_CODE_BLOCK_PADDING_Y + lineCount * MARKDOWN_CODE_LINE_HEIGHT;
}

export function estimateVideoBlockHeight(contentWidth: number): number {
  const videoWidth = Math.max(1, Math.min(contentWidth, MARKDOWN_VIDEO_MAX_WIDTH));
  return videoWidth * (themeDomStyleTokens.iframeDefaultHeight / themeDomStyleTokens.iframeDefaultWidth);
}

export function measureErrorHeight(text: string, width: number): number {
  return measureTextBlockHeight(text, width, {
    font: MARKDOWN_BODY_FONT,
    lineHeight: ASSISTANT_ERROR_LINE_HEIGHT,
    minHeight: ASSISTANT_ERROR_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });
}
