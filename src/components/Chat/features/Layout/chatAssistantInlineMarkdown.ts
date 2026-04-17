import {
  prepareRichInline,
  type PreparedRichInline,
  type RichInlineItem,
} from '@/lib/text-layout';
import {
  BODY_BOLD_FONT,
  BODY_BOLD_ITALIC_FONT,
  BODY_FONT,
  BODY_ITALIC_FONT,
  BODY_LINK_FONT,
  HEADING_ONE_BOLD_FONT,
  HEADING_ONE_BOLD_ITALIC_FONT,
  HEADING_ONE_FONT,
  HEADING_ONE_ITALIC_FONT,
  HEADING_THREE_BOLD_FONT,
  HEADING_THREE_BOLD_ITALIC_FONT,
  HEADING_THREE_FONT,
  HEADING_THREE_ITALIC_FONT,
  HEADING_TWO_BOLD_FONT,
  HEADING_TWO_BOLD_ITALIC_FONT,
  HEADING_TWO_FONT,
  HEADING_TWO_ITALIC_FONT,
  INLINE_CODE_EXTRA_WIDTH,
  INLINE_CODE_FONT,
} from './chatAssistantMarkdownTheme';
import type { TextBlockVariant } from './chatAssistantMarkdownTypes';
import {
  setCacheEntry,
  touchCacheEntry,
} from './chatLayoutCache';

type InlineMarks = {
  bold: boolean;
  italic: boolean;
  link: boolean;
};

const LINK_TOKEN_RE = /\[([^\]]+)\]\(([^)]+)\)/;
const INLINE_CODE_TOKEN_RE = /`([^`]+)`/;
const STRONG_TOKEN_RE = /(\*\*|__)([\s\S]+?)\1/;
const EMPHASIS_TOKEN_RE = /(\*|_)([^*_][\s\S]*?)\1/;
const STRIKE_TOKEN_RE = /~~([\s\S]+?)~~/;
const PREPARED_TEXT_BLOCK_CACHE_LIMIT = 400;

const preparedTextBlockCache = new Map<string, PreparedRichInline>();

function pushRichInlineItem(target: RichInlineItem[], item: RichInlineItem): void {
  if (!item.text) {
    return;
  }

  const previous = target[target.length - 1];
  if (
    previous &&
    previous.font === item.font &&
    previous.break === item.break &&
    (previous.extraWidth ?? 0) === (item.extraWidth ?? 0)
  ) {
    previous.text += item.text;
    return;
  }

  target.push(item);
}

function getVariantBaseFont(variant: TextBlockVariant): string {
  switch (variant) {
    case 'heading-1':
      return HEADING_ONE_FONT;
    case 'heading-2':
      return HEADING_TWO_FONT;
    case 'heading-3':
      return HEADING_THREE_FONT;
    case 'body':
      return BODY_FONT;
  }
}

function resolveInlineFont(variant: TextBlockVariant, marks: InlineMarks): string {
  if (marks.link && variant === 'body' && !marks.bold && !marks.italic) {
    return BODY_LINK_FONT;
  }

  if (variant === 'body') {
    if (marks.bold && marks.italic) return BODY_BOLD_ITALIC_FONT;
    if (marks.bold) return BODY_BOLD_FONT;
    if (marks.italic) return BODY_ITALIC_FONT;
    return BODY_FONT;
  }

  if (variant === 'heading-1') {
    if (marks.bold && marks.italic) return HEADING_ONE_BOLD_ITALIC_FONT;
    if (marks.bold) return HEADING_ONE_BOLD_FONT;
    if (marks.italic) return HEADING_ONE_ITALIC_FONT;
    return HEADING_ONE_FONT;
  }

  if (variant === 'heading-2') {
    if (marks.bold && marks.italic) return HEADING_TWO_BOLD_ITALIC_FONT;
    if (marks.bold) return HEADING_TWO_BOLD_FONT;
    if (marks.italic) return HEADING_TWO_ITALIC_FONT;
    return HEADING_TWO_FONT;
  }

  if (marks.bold && marks.italic) return HEADING_THREE_BOLD_ITALIC_FONT;
  if (marks.bold) return HEADING_THREE_BOLD_FONT;
  if (marks.italic) return HEADING_THREE_ITALIC_FONT;
  return HEADING_THREE_FONT;
}

function tokenizeInlineMarkdown(
  text: string,
  variant: TextBlockVariant,
  marks: InlineMarks = { bold: false, italic: false, link: false },
): RichInlineItem[] {
  const items: RichInlineItem[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const candidates = [
      { kind: 'link', match: LINK_TOKEN_RE.exec(remaining) },
      { kind: 'code', match: INLINE_CODE_TOKEN_RE.exec(remaining) },
      { kind: 'strong', match: STRONG_TOKEN_RE.exec(remaining) },
      { kind: 'strike', match: STRIKE_TOKEN_RE.exec(remaining) },
      { kind: 'emphasis', match: EMPHASIS_TOKEN_RE.exec(remaining) },
    ]
      .filter((candidate): candidate is { kind: string; match: RegExpExecArray } => candidate.match !== null)
      .sort((a, b) => a.match.index - b.match.index)[0];

    if (!candidates) {
      pushRichInlineItem(items, {
        text: remaining,
        font: resolveInlineFont(variant, marks),
      });
      break;
    }

    const { kind, match } = candidates;
    const matchIndex = match.index;
    if (matchIndex > 0) {
      pushRichInlineItem(items, {
        text: remaining.slice(0, matchIndex),
        font: resolveInlineFont(variant, marks),
      });
    }

    if (kind === 'code') {
      pushRichInlineItem(items, {
        text: match[1] ?? '',
        font: INLINE_CODE_FONT,
        extraWidth: INLINE_CODE_EXTRA_WIDTH,
      });
    } else if (kind === 'link') {
      tokenizeInlineMarkdown(match[1] ?? '', variant, { ...marks, link: true }).forEach((item) => {
        pushRichInlineItem(items, item);
      });
    } else if (kind === 'strong') {
      tokenizeInlineMarkdown(match[2] ?? '', variant, { ...marks, bold: true }).forEach((item) => {
        pushRichInlineItem(items, item);
      });
    } else if (kind === 'emphasis') {
      tokenizeInlineMarkdown(match[2] ?? '', variant, { ...marks, italic: true }).forEach((item) => {
        pushRichInlineItem(items, item);
      });
    } else {
      tokenizeInlineMarkdown(match[1] ?? '', variant, marks).forEach((item) => {
        pushRichInlineItem(items, item);
      });
    }

    remaining = remaining.slice(matchIndex + match[0].length);
  }

  if (items.length === 0) {
    return [{
      text: text || ' ',
      font: getVariantBaseFont(variant),
    }];
  }

  return items;
}

export function normalizeInlineMarkdownForMeasurement(content: string): string {
  return content
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function getPreparedMarkdownTextBlock(
  text: string,
  variant: TextBlockVariant,
): PreparedRichInline {
  const key = `${variant}\u0000${text}`;
  const cached = touchCacheEntry(preparedTextBlockCache, key);
  if (cached) {
    return cached;
  }

  const prepared = prepareRichInline(tokenizeInlineMarkdown(text, variant));
  setCacheEntry(preparedTextBlockCache, key, prepared, PREPARED_TEXT_BLOCK_CACHE_LIMIT);
  return prepared;
}
