import { describe, expect, it } from 'vitest';
import { getPreparedMarkdownTextBlock } from './chatAssistantInlineMarkdown';

describe('chatAssistantInlineMarkdown', () => {
  it('caches ordinary prepared markdown text blocks', () => {
    const text = 'Small **markdown** text';

    expect(getPreparedMarkdownTextBlock(text, 'body')).toBe(getPreparedMarkdownTextBlock(text, 'body'));
  });

  it('does not cache oversized prepared markdown text blocks by full content', () => {
    const text = 'Large markdown text '.repeat(1200);

    expect(getPreparedMarkdownTextBlock(text, 'body')).not.toBe(getPreparedMarkdownTextBlock(text, 'body'));
  });
});
