import {
  measureRichInlineStats,
  measureTextBlockHeight,
  type PreparedRichInline,
} from '@/lib/text-layout';
import {
  ASSISTANT_CODE_HEADER_HEIGHT,
  ASSISTANT_CODE_PADDING_Y,
  ASSISTANT_RULE_HEIGHT,
  CODE_LINE_HEIGHT,
  ERROR_FONT,
  ERROR_LINE_HEIGHT,
} from './chatAssistantMarkdownTheme';
import {
  getPreparedMarkdownTextBlock,
  normalizeInlineMarkdownForMeasurement,
} from './chatAssistantInlineMarkdown';
import type { TextBlockVariant } from './chatAssistantMarkdownTypes';

export type MarkdownMeasurementBlock =
  | {
      kind: 'text';
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
    };

export type { TextBlockVariant } from './chatAssistantMarkdownTypes';

export function buildMarkdownTextBlock(
  text: string,
  variant: TextBlockVariant,
  lineHeight: number,
  widthInset: number = 0,
): MarkdownMeasurementBlock | null {
  const normalized = normalizeInlineMarkdownForMeasurement(text);
  if (!normalized) {
    return null;
  }

  return {
    kind: 'text',
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
      ) * block.lineHeight;
    case 'code':
      return estimateCodeBlockHeight(block.code);
    case 'rule':
      return ASSISTANT_RULE_HEIGHT;
  }
}

export function estimateCodeBlockHeight(code: string): number {
  const lineCount = Math.max(code.replace(/\n$/, '').split('\n').length, 1);
  return ASSISTANT_CODE_HEADER_HEIGHT + ASSISTANT_CODE_PADDING_Y + lineCount * CODE_LINE_HEIGHT;
}

export function measureErrorHeight(text: string, width: number): number {
  return measureTextBlockHeight(text, width, {
    font: ERROR_FONT,
    lineHeight: ERROR_LINE_HEIGHT,
    minHeight: ERROR_LINE_HEIGHT,
    prepareOptions: { whiteSpace: 'pre-wrap' },
  });
}
