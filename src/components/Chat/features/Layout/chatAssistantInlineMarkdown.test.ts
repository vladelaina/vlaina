import { describe, expect, it } from 'vitest';
import {
  materializeRichInlineLineRange,
  walkRichInlineLineRanges,
} from '@/lib/text-layout';
import {
  getPreparedMarkdownTextBlock,
  MAX_INLINE_MARKDOWN_TOKEN_ITEMS,
  MAX_TOKENIZED_INLINE_MARKDOWN_CHARS,
} from './chatAssistantInlineMarkdown';

function materializePreparedText(text: string): string {
  const prepared = getPreparedMarkdownTextBlock(text, 'body');
  const chunks: string[] = [];
  walkRichInlineLineRanges(prepared, 1_000_000, (line) => {
    const materialized = materializeRichInlineLineRange(prepared, line);
    chunks.push(materialized.fragments.map((fragment) => fragment.text).join(''));
  });
  return chunks.join('');
}

describe('chatAssistantInlineMarkdown', () => {
  it('caches ordinary prepared markdown text blocks', () => {
    const text = 'Small **markdown** text';

    expect(getPreparedMarkdownTextBlock(text, 'body')).toBe(getPreparedMarkdownTextBlock(text, 'body'));
  });

  it('does not cache oversized prepared markdown text blocks by full content', () => {
    const text = 'Large markdown text '.repeat(1200);

    expect(getPreparedMarkdownTextBlock(text, 'body')).not.toBe(getPreparedMarkdownTextBlock(text, 'body'));
  });

  it('keeps remaining inline markdown as plain text after the item budget is reached', () => {
    const markdown = Array.from(
      { length: MAX_INLINE_MARKDOWN_TOKEN_ITEMS + 8 },
      (_, index) => `**bold${index}**_italic${index}_`
    ).join('');
    const parsedPairCount = Math.floor(MAX_INLINE_MARKDOWN_TOKEN_ITEMS / 2);
    const parsedPrefix = Array.from(
      { length: parsedPairCount },
      (_, index) => `bold${index}italic${index}`
    ).join('');
    const rawRemainder = Array.from(
      { length: MAX_INLINE_MARKDOWN_TOKEN_ITEMS + 8 - parsedPairCount },
      (_, index) => {
        const itemIndex = parsedPairCount + index;
        return `**bold${itemIndex}**_italic${itemIndex}_`;
      }
    ).join('');

    expect(materializePreparedText(markdown)).toBe(`${parsedPrefix}${rawRemainder}`);
  });

  it('treats oversized inline markdown as plain measurement text', () => {
    const markdown = `**${'a'.repeat(MAX_TOKENIZED_INLINE_MARKDOWN_CHARS + 1)}**`;

    expect(materializePreparedText(markdown)).toBe(markdown);
  });
});
