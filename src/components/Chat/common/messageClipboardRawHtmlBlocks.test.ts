import { describe, expect, it } from 'vitest';
import {
  extractMessageImageSources,
  formatMessageCopyText,
  stripMessageImageTokens,
} from './messageClipboard';

describe('messageClipboard raw HTML blocks', () => {
  it('ignores images inside sanitizer-dropped raw HTML containers', () => {
    const content = [
      '<svg>',
      '![hidden-markdown](https://example.com/hidden-markdown.png)',
      '<img src="https://example.com/hidden-html.png">',
      '</svg>',
      '<img src="https://example.com/real-html.png">',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(extractMessageImageSources(content)).toEqual([
      'https://example.com/real-html.png',
      'https://example.com/real.png',
    ]);
    expect(stripMessageImageTokens(content)).toContain('https://example.com/hidden-html.png');
    expect(formatMessageCopyText(content)).toContain('https://example.com/hidden-markdown.png');
    expect(formatMessageCopyText(content)).not.toContain('![real](https://example.com/real.png)');
  });

  it('ignores images inside blockquote sanitizer-dropped raw HTML containers', () => {
    const content = [
      '> <svg>',
      '> ![hidden-markdown](https://example.com/hidden-markdown.png)',
      '> <img src="https://example.com/hidden-html.png">',
      '> </svg>',
      '<img src="https://example.com/real-html.png">',
    ].join('\n');

    expect(extractMessageImageSources(content)).toEqual([
      'https://example.com/real-html.png',
    ]);
    expect(formatMessageCopyText(content)).toContain('https://example.com/hidden-html.png');
  });

  it('keeps renderable raw HTML image tags inside GFM HTML blocks', () => {
    const content = [
      '<custom-element>',
      '<img src="https://example.com/rendered-html.png">',
      '</custom-element>',
      '',
      '![real](https://example.com/real.png)',
    ].join('\n');

    expect(extractMessageImageSources(content)).toEqual([
      'https://example.com/rendered-html.png',
      'https://example.com/real.png',
    ]);
    expect(formatMessageCopyText(content)).toContain('https://example.com/rendered-html.png');
  });
});
