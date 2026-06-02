import { describe, expect, it } from 'vitest';
import { protectCustomInlineMarkdownText } from './customInlineMarkStringify';

describe('protectCustomInlineMarkdownText', () => {
  it('escapes plain text that would otherwise serialize as custom inline marks', () => {
    expect(protectCustomInlineMarkdownText('==mark== ++under++ X^2^ H~2~O')).toBe(
      '\\==mark== \\++under++ X\\^2^ H\\~2~O'
    );
  });

  it('is stable when multiple markdown plugins wrap the text handler', () => {
    const once = protectCustomInlineMarkdownText('==mark== ++under++ X^2^ H~2~O');

    expect(protectCustomInlineMarkdownText(once)).toBe(once);
  });

  it('does not rewrite gfm strikethrough delimiters', () => {
    expect(protectCustomInlineMarkdownText('~~deleted~~')).toBe('~~deleted~~');
  });
});
