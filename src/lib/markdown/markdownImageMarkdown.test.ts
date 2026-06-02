import { describe, expect, it } from 'vitest';
import {
  escapeMarkdownAngleDestination,
  formatMarkdownImage,
} from './markdownImageMarkdown';

describe('markdownImageMarkdown', () => {
  it('preserves ordinary angle destinations while escaping markdown-breaking characters', () => {
    expect(formatMarkdownImage('image one.png')).toBe('![image](<image one.png>)');
    expect(formatMarkdownImage('https://example.test/a>b.png', 'A ] alt')).toBe(
      '![A \\] alt](<https://example.test/a%3Eb.png>)',
    );
  });

  it('can strip generated image destination whitespace before formatting', () => {
    expect(escapeMarkdownAngleDestination('data:image/png;base64, ab\nc ', { stripWhitespace: true })).toBe(
      'data:image/png;base64,abc',
    );
    expect(formatMarkdownImage('data:image/png;base64, ab\nc ', 'Generated ] image', {
      stripDestinationWhitespace: true,
    })).toBe('![Generated \\] image](<data:image/png;base64,abc>)');
  });
});
