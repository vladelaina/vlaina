import {
  APP_MONO_FONT_FAMILY,
  APP_SANS_FONT_FAMILY,
} from '@/lib/typography/fontFamilies';
import { themeFontWeightTokens, themeMarkdownMetricTokens } from '@/styles/themeTokens';

export const MARKDOWN_BODY_FONT_SIZE = themeMarkdownMetricTokens.bodyFontSizePx;
export const MARKDOWN_INLINE_CODE_FONT_SIZE = themeMarkdownMetricTokens.inlineCodeFontSizePx;

export const MARKDOWN_BODY_FONT = `normal ${themeFontWeightTokens.normal} ${MARKDOWN_BODY_FONT_SIZE}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_BODY_LINK_FONT = `normal ${themeFontWeightTokens.medium} ${MARKDOWN_BODY_FONT_SIZE}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_BODY_BOLD_FONT = `normal ${themeFontWeightTokens.semibold} ${MARKDOWN_BODY_FONT_SIZE}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_BODY_ITALIC_FONT = `italic ${themeFontWeightTokens.normal} ${MARKDOWN_BODY_FONT_SIZE}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_BODY_BOLD_ITALIC_FONT = `italic ${themeFontWeightTokens.semibold} ${MARKDOWN_BODY_FONT_SIZE}px ${APP_SANS_FONT_FAMILY}`;

export const MARKDOWN_HEADING_ONE_FONT = `normal ${themeFontWeightTokens.bold} ${themeMarkdownMetricTokens.headingOneFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_TWO_FONT = `normal ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingTwoFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_THREE_FONT = `normal ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingThreeFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_FOUR_FONT = `normal ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingFourFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_FIVE_FONT = `normal ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingFiveFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_SIX_FONT = `normal ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingSixFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_ONE_BOLD_FONT = MARKDOWN_HEADING_ONE_FONT;
export const MARKDOWN_HEADING_ONE_ITALIC_FONT = `italic ${themeFontWeightTokens.bold} ${themeMarkdownMetricTokens.headingOneFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_ONE_BOLD_ITALIC_FONT = MARKDOWN_HEADING_ONE_ITALIC_FONT;
export const MARKDOWN_HEADING_TWO_BOLD_FONT = MARKDOWN_HEADING_TWO_FONT;
export const MARKDOWN_HEADING_TWO_ITALIC_FONT = `italic ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingTwoFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_TWO_BOLD_ITALIC_FONT = MARKDOWN_HEADING_TWO_ITALIC_FONT;
export const MARKDOWN_HEADING_THREE_BOLD_FONT = MARKDOWN_HEADING_THREE_FONT;
export const MARKDOWN_HEADING_THREE_ITALIC_FONT = `italic ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingThreeFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_THREE_BOLD_ITALIC_FONT = MARKDOWN_HEADING_THREE_ITALIC_FONT;
export const MARKDOWN_HEADING_FOUR_BOLD_FONT = MARKDOWN_HEADING_FOUR_FONT;
export const MARKDOWN_HEADING_FOUR_ITALIC_FONT = `italic ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingFourFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_FOUR_BOLD_ITALIC_FONT = MARKDOWN_HEADING_FOUR_ITALIC_FONT;
export const MARKDOWN_HEADING_FIVE_BOLD_FONT = MARKDOWN_HEADING_FIVE_FONT;
export const MARKDOWN_HEADING_FIVE_ITALIC_FONT = `italic ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingFiveFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_FIVE_BOLD_ITALIC_FONT = MARKDOWN_HEADING_FIVE_ITALIC_FONT;
export const MARKDOWN_HEADING_SIX_BOLD_FONT = MARKDOWN_HEADING_SIX_FONT;
export const MARKDOWN_HEADING_SIX_ITALIC_FONT = `italic ${themeFontWeightTokens.semibold} ${themeMarkdownMetricTokens.headingSixFontSizePx}px ${APP_SANS_FONT_FAMILY}`;
export const MARKDOWN_HEADING_SIX_BOLD_ITALIC_FONT = MARKDOWN_HEADING_SIX_ITALIC_FONT;

export const MARKDOWN_INLINE_CODE_FONT = `${themeFontWeightTokens.medium} ${MARKDOWN_INLINE_CODE_FONT_SIZE}px ${APP_MONO_FONT_FAMILY}`;
export const MARKDOWN_INLINE_CODE_EXTRA_WIDTH = themeMarkdownMetricTokens.inlineCodeExtraWidthPx;

export const MARKDOWN_BODY_LINE_HEIGHT = MARKDOWN_BODY_FONT_SIZE + themeMarkdownMetricTokens.bodyLineHeightExtraPx;
export const MARKDOWN_HEADING_ONE_LINE_HEIGHT = themeMarkdownMetricTokens.headingOneLineHeightPx;
export const MARKDOWN_HEADING_TWO_LINE_HEIGHT = themeMarkdownMetricTokens.headingTwoLineHeightPx;
export const MARKDOWN_HEADING_THREE_LINE_HEIGHT = themeMarkdownMetricTokens.headingThreeLineHeightPx;
export const MARKDOWN_HEADING_FOUR_LINE_HEIGHT = themeMarkdownMetricTokens.headingFourLineHeightPx;
export const MARKDOWN_HEADING_FIVE_LINE_HEIGHT = themeMarkdownMetricTokens.headingFiveLineHeightPx;
export const MARKDOWN_HEADING_SIX_LINE_HEIGHT = themeMarkdownMetricTokens.headingSixLineHeightPx;
export const MARKDOWN_CODE_LINE_HEIGHT = MARKDOWN_BODY_LINE_HEIGHT;
export const MARKDOWN_BLOCKQUOTE_LINE_HEIGHT = MARKDOWN_BODY_LINE_HEIGHT;
export const MARKDOWN_BLOCKQUOTE_CONTENT_INSET = themeMarkdownMetricTokens.blockquoteContentInsetPx;
export const MARKDOWN_BLOCKQUOTE_PADDING_Y = themeMarkdownMetricTokens.blockquotePaddingYPx;
export const MARKDOWN_CODE_BLOCK_HEADER_HEIGHT = themeMarkdownMetricTokens.codeBlockHeaderHeightPx;
export const MARKDOWN_CODE_BLOCK_PADDING_Y = themeMarkdownMetricTokens.codeBlockPaddingYPx;
export const MARKDOWN_RULE_HEIGHT = themeMarkdownMetricTokens.ruleHeightPx;
export const MARKDOWN_BLOCK_GAP = themeMarkdownMetricTokens.blockGapPx;
export const MARKDOWN_LIST_CONTENT_INSET = themeMarkdownMetricTokens.listContentInsetPx;
export const MARKDOWN_LIST_MARGIN_Y = themeMarkdownMetricTokens.listMarginYPx;
export const MARKDOWN_LIST_ITEM_MARGIN_Y = themeMarkdownMetricTokens.listItemMarginYPx;
export const MARKDOWN_TABLE_MARGIN_Y = themeMarkdownMetricTokens.tableMarginYPx;
export const MARKDOWN_TABLE_LINE_HEIGHT = MARKDOWN_BODY_LINE_HEIGHT;
export const MARKDOWN_TABLE_CELL_PADDING_Y = themeMarkdownMetricTokens.tableCellPaddingYPx;
export const MARKDOWN_TABLE_BORDER_Y = themeMarkdownMetricTokens.tableBorderYPx;
export const MARKDOWN_TABLE_ROW_BORDER_Y = themeMarkdownMetricTokens.tableRowBorderYPx;

const MARKDOWN_HEADING_METRICS = [
  [themeMarkdownMetricTokens.headingOneFontSizePx, themeMarkdownMetricTokens.headingOneLineHeightPx],
  [themeMarkdownMetricTokens.headingTwoFontSizePx, themeMarkdownMetricTokens.headingTwoLineHeightPx],
  [themeMarkdownMetricTokens.headingThreeFontSizePx, themeMarkdownMetricTokens.headingThreeLineHeightPx],
  [themeMarkdownMetricTokens.headingFourFontSizePx, themeMarkdownMetricTokens.headingFourLineHeightPx],
  [themeMarkdownMetricTokens.headingFiveFontSizePx, themeMarkdownMetricTokens.headingFiveLineHeightPx],
  [themeMarkdownMetricTokens.headingSixFontSizePx, themeMarkdownMetricTokens.headingSixLineHeightPx],
] as const;

export function normalizeMarkdownBodyFontSize(fontSize: number = MARKDOWN_BODY_FONT_SIZE): number {
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : MARKDOWN_BODY_FONT_SIZE;
}

export function getMarkdownFontScale(fontSize: number = MARKDOWN_BODY_FONT_SIZE): number {
  return normalizeMarkdownBodyFontSize(fontSize) / MARKDOWN_BODY_FONT_SIZE;
}

export function getMarkdownBodyFont(fontSize: number = MARKDOWN_BODY_FONT_SIZE): string {
  return `normal ${themeFontWeightTokens.normal} ${normalizeMarkdownBodyFontSize(fontSize)}px ${APP_SANS_FONT_FAMILY}`;
}

export function getMarkdownBodyLineHeight(fontSize: number = MARKDOWN_BODY_FONT_SIZE): number {
  return normalizeMarkdownBodyFontSize(fontSize) + themeMarkdownMetricTokens.bodyLineHeightExtraPx;
}

export function getMarkdownTextLineHeight(
  variant: 'body' | 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4' | 'heading-5' | 'heading-6',
  fontSize: number = MARKDOWN_BODY_FONT_SIZE,
): number {
  if (variant === 'body') {
    return getMarkdownBodyLineHeight(fontSize);
  }

  const level = Number.parseInt(variant.slice('heading-'.length), 10);
  const [defaultHeadingSize, defaultLineHeight] = MARKDOWN_HEADING_METRICS[level - 1]
    ?? MARKDOWN_HEADING_METRICS[5];
  const lineHeightExtra = defaultLineHeight - defaultHeadingSize;
  return defaultHeadingSize * getMarkdownFontScale(fontSize) + lineHeightExtra;
}
