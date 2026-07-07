import {
  MARKDOWN_BODY_BOLD_FONT,
  MARKDOWN_BODY_BOLD_ITALIC_FONT,
  MARKDOWN_BODY_FONT,
  MARKDOWN_BODY_ITALIC_FONT,
  MARKDOWN_BODY_LINK_FONT,
  MARKDOWN_HEADING_ONE_BOLD_FONT,
  MARKDOWN_HEADING_ONE_BOLD_ITALIC_FONT,
  MARKDOWN_HEADING_ONE_FONT,
  MARKDOWN_HEADING_ONE_ITALIC_FONT,
  MARKDOWN_HEADING_FIVE_BOLD_FONT,
  MARKDOWN_HEADING_FIVE_BOLD_ITALIC_FONT,
  MARKDOWN_HEADING_FIVE_FONT,
  MARKDOWN_HEADING_FIVE_ITALIC_FONT,
  MARKDOWN_HEADING_FOUR_BOLD_FONT,
  MARKDOWN_HEADING_FOUR_BOLD_ITALIC_FONT,
  MARKDOWN_HEADING_FOUR_FONT,
  MARKDOWN_HEADING_FOUR_ITALIC_FONT,
  MARKDOWN_HEADING_SIX_BOLD_FONT,
  MARKDOWN_HEADING_SIX_BOLD_ITALIC_FONT,
  MARKDOWN_HEADING_SIX_FONT,
  MARKDOWN_HEADING_SIX_ITALIC_FONT,
  MARKDOWN_HEADING_THREE_BOLD_FONT,
  MARKDOWN_HEADING_THREE_BOLD_ITALIC_FONT,
  MARKDOWN_HEADING_THREE_FONT,
  MARKDOWN_HEADING_THREE_ITALIC_FONT,
  MARKDOWN_HEADING_TWO_BOLD_FONT,
  MARKDOWN_HEADING_TWO_BOLD_ITALIC_FONT,
  MARKDOWN_HEADING_TWO_FONT,
  MARKDOWN_HEADING_TWO_ITALIC_FONT,
} from '@/components/common/markdown/markdownMetrics';
import type { TextBlockVariant } from './chatAssistantMarkdownTypes';

export type InlineMarks = {
  bold: boolean;
  italic: boolean;
  link: boolean;
};

export function getVariantBaseFont(variant: TextBlockVariant): string {
  switch (variant) {
    case 'heading-1':
      return MARKDOWN_HEADING_ONE_FONT;
    case 'heading-2':
      return MARKDOWN_HEADING_TWO_FONT;
    case 'heading-3':
      return MARKDOWN_HEADING_THREE_FONT;
    case 'heading-4':
      return MARKDOWN_HEADING_FOUR_FONT;
    case 'heading-5':
      return MARKDOWN_HEADING_FIVE_FONT;
    case 'heading-6':
      return MARKDOWN_HEADING_SIX_FONT;
    case 'body':
      return MARKDOWN_BODY_FONT;
  }
}

export function resolveInlineFont(variant: TextBlockVariant, marks: InlineMarks): string {
  if (marks.link && variant === 'body' && !marks.bold && !marks.italic) {
    return MARKDOWN_BODY_LINK_FONT;
  }

  if (variant === 'body') {
    if (marks.bold && marks.italic) return MARKDOWN_BODY_BOLD_ITALIC_FONT;
    if (marks.bold) return MARKDOWN_BODY_BOLD_FONT;
    if (marks.italic) return MARKDOWN_BODY_ITALIC_FONT;
    return MARKDOWN_BODY_FONT;
  }

  if (variant === 'heading-1') {
    if (marks.bold && marks.italic) return MARKDOWN_HEADING_ONE_BOLD_ITALIC_FONT;
    if (marks.bold) return MARKDOWN_HEADING_ONE_BOLD_FONT;
    if (marks.italic) return MARKDOWN_HEADING_ONE_ITALIC_FONT;
    return MARKDOWN_HEADING_ONE_FONT;
  }

  if (variant === 'heading-2') {
    if (marks.bold && marks.italic) return MARKDOWN_HEADING_TWO_BOLD_ITALIC_FONT;
    if (marks.bold) return MARKDOWN_HEADING_TWO_BOLD_FONT;
    if (marks.italic) return MARKDOWN_HEADING_TWO_ITALIC_FONT;
    return MARKDOWN_HEADING_TWO_FONT;
  }

  if (variant === 'heading-3') {
    if (marks.bold && marks.italic) return MARKDOWN_HEADING_THREE_BOLD_ITALIC_FONT;
    if (marks.bold) return MARKDOWN_HEADING_THREE_BOLD_FONT;
    if (marks.italic) return MARKDOWN_HEADING_THREE_ITALIC_FONT;
    return MARKDOWN_HEADING_THREE_FONT;
  }

  if (variant === 'heading-4') {
    if (marks.bold && marks.italic) return MARKDOWN_HEADING_FOUR_BOLD_ITALIC_FONT;
    if (marks.bold) return MARKDOWN_HEADING_FOUR_BOLD_FONT;
    if (marks.italic) return MARKDOWN_HEADING_FOUR_ITALIC_FONT;
    return MARKDOWN_HEADING_FOUR_FONT;
  }

  if (variant === 'heading-5') {
    if (marks.bold && marks.italic) return MARKDOWN_HEADING_FIVE_BOLD_ITALIC_FONT;
    if (marks.bold) return MARKDOWN_HEADING_FIVE_BOLD_FONT;
    if (marks.italic) return MARKDOWN_HEADING_FIVE_ITALIC_FONT;
    return MARKDOWN_HEADING_FIVE_FONT;
  }

  if (marks.bold && marks.italic) return MARKDOWN_HEADING_SIX_BOLD_ITALIC_FONT;
  if (marks.bold) return MARKDOWN_HEADING_SIX_BOLD_FONT;
  if (marks.italic) return MARKDOWN_HEADING_SIX_ITALIC_FONT;
  return MARKDOWN_HEADING_SIX_FONT;
}
