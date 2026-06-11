import { describe, expect, it } from 'vitest';
import { sanitizeRawMarkdownHtmlValue } from './themeTextSchemaOverrides';

describe('themeTextSchemaOverrides', () => {
  it('keeps internal markdown artifact comments', () => {
    expect(sanitizeRawMarkdownHtmlValue('<!--vlaina-markdown-blank-line-->')).toBe(
      '<!--vlaina-markdown-blank-line-->',
    );
  });

  it('sanitizes unsafe raw markdown HTML values', () => {
    expect(sanitizeRawMarkdownHtmlValue('<img src="javascript:alert(1)" onerror="alert(1)">')).toBe('<img>');
  });

  it('drops oversized non-rendering raw markdown HTML before bypassing the sanitizer', () => {
    const value = `<!--${'x'.repeat(2 * 1024 * 1024)}-->`;

    expect(sanitizeRawMarkdownHtmlValue(value)).toBe('');
  });
});
