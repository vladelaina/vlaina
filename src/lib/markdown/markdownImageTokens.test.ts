import { describe, expect, it } from 'vitest';
import {
  parseHtmlImageTokens,
  parseMarkdownAndHtmlImageTokens,
  parseMarkdownImageTokens,
} from './markdownImageTokens';

function parseSeparateImageTokens(markdown: string) {
  return [
    ...parseMarkdownImageTokens(markdown),
    ...parseHtmlImageTokens(markdown),
  ].sort((a, b) => a.start - b.start);
}

describe('markdownImageTokens', () => {
  it('parses combined markdown and html image tokens like the separate parsers', () => {
    const markdown = [
      'Intro ![markdown](https://example.com/a.png)',
      '<img src="https://example.com/b.png" alt="b">',
      '`![code](https://example.com/code.png)`',
      '<!-- <img src="https://example.com/comment.png"> -->',
      '```md',
      '![fenced](https://example.com/fenced.png)',
      '```',
      '<p><img src="https://example.com/block.png"></p>',
      'Tail ![nested [label]](<https://example.com/c.png>)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown)).toEqual(parseSeparateImageTokens(markdown));
  });
});
