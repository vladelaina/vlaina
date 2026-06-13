import { describe, expect, it } from 'vitest';
import {
  normalizeMarkdownInlineTextForMeasurement,
  stripMarkdownInline,
} from './plainText';

describe('markdown plain text helpers', () => {
  it('strips standard and Notes inline markdown for plain-text exports', () => {
    expect(stripMarkdownInline(
      '**bold** _em_ `code` ~~strike~~ ==mark== ++under++ H~2~O x^2^ [link](https://example.com) ![alt](asset://image)'
    )).toBe('bold em code strike mark under H2O x2 link alt');
  });

  it('preserves escaped Notes inline markdown as visible text for plain-text exports', () => {
    expect(stripMarkdownInline(
      '\\==mark== \\++under++ H\\~2\\~O x\\^2^ \\[link](https://example.com) \\![alt](asset://image)'
    )).toBe('==mark== ++under++ H~2~O x^2^ [link](https://example.com) ![alt](asset://image)');
  });

  it('normalizes inline markdown for measurement without removing visible text', () => {
    expect(normalizeMarkdownInlineTextForMeasurement(
      '![diagram](asset://image)\n<a>safe</a> escaped\\*word\\*'
    )).toBe('diagram safe escaped*word*');
  });

  it('can omit markdown image alt text for editor-find aligned search text', () => {
    expect(stripMarkdownInline(
      'Before ![hidden alt](asset://image) [visible link](https://example.test) after',
      { preserveImageAlt: false },
    )).toBe('Before  visible link after');
  });

  it('strips markdown links with nested labels and parenthesized targets', () => {
    expect(stripMarkdownInline(
      '[outer [nested](https://example.com/not-target)](https://example.com/real_(1)) ![alt `](not-target)`](<asset://real(image).png>)'
    )).toBe('outer nested alt ](not-target)');
  });

  it('keeps markdown link examples inside inline code as visible text', () => {
    expect(stripMarkdownInline(
      '`![example](asset://code.png)` and `[link](https://example.com/code)` then [real](https://example.com/real)'
    )).toBe('![example](asset://code.png) and [link](https://example.com/code) then real');
  });

  it('bounds deeply nested markdown link stripping', () => {
    let markdown = 'visible text';
    for (let index = 0; index < 5000; index += 1) {
      markdown = `[${markdown}](https://hidden-${index}.example/path)`;
    }

    let stripped = '';
    expect(() => {
      stripped = stripMarkdownInline(markdown);
    }).not.toThrow();
    expect(stripped).not.toContain('hidden-');
  });

  it('keeps escaped Notes inline delimiters visible during measurement normalization', () => {
    expect(normalizeMarkdownInlineTextForMeasurement(
      '\\==mark== \\++under++ H\\~2\\~O x\\^2^'
    )).toBe('==mark== ++under++ H~2~O x^2^');
  });
});
