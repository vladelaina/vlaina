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

  it('ignores markdown and html image syntax inside raw pre blocks', () => {
    const markdown = [
      '<pre>',
      '![example](https://example.com/code.png)',
      '<img src="https://example.com/code-html.png">',
      '</pre>',
      '',
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
      'https://example.com/real-html.png',
    ]);
  });

  it('ignores image syntax inside raw html tags whose contents are dropped by sanitizers', () => {
    const markdown = [
      '<svg><image href="https://example.com/svg.png"></image></svg>',
      '<noscript><img src="https://example.com/noscript.png"></noscript>',
      '<noembed>![embed](https://example.com/noembed.png)</noembed>',
      '<noframes><img src="https://example.com/noframes.png"></noframes>',
      '<math><img src="https://example.com/math.png"></math>',
      '',
      '![real](https://example.com/real.png)',
      '<img src="https://example.com/real-html.png">',
      '<plaintext><img src="https://example.com/plaintext.png"></plaintext>',
      '![hidden](https://example.com/after-plaintext.png)',
    ].join('\n');

    expect(parseMarkdownAndHtmlImageTokens(markdown).map((token) => token.src)).toEqual([
      'https://example.com/real.png',
      'https://example.com/real-html.png',
    ]);
  });
});
