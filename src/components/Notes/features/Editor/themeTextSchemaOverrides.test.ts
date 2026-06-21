import { describe, expect, it } from 'vitest';
import {
  renderRawMarkdownHtmlValueIntoElement,
  sanitizeRawMarkdownHtmlValue,
  shouldRenderRawMarkdownHtmlValueAsLiteralText,
} from './themeTextSchemaOverrides';

describe('themeTextSchemaOverrides', () => {
  it('keeps internal markdown artifact comments', () => {
    expect(sanitizeRawMarkdownHtmlValue('<!--vlaina-markdown-blank-line-->')).toBe(
      '<!--vlaina-markdown-blank-line-->',
    );
  });

  it('renders authored markdown html comments as literal editor text', () => {
    const element = document.createElement('div');

    expect(shouldRenderRawMarkdownHtmlValueAsLiteralText('<!--注释-->')).toBe(true);
    expect(shouldRenderRawMarkdownHtmlValueAsLiteralText('<!--vlaina-markdown-blank-line-->')).toBe(false);
    expect(shouldRenderRawMarkdownHtmlValueAsLiteralText('<!--align:center-->')).toBe(false);

    renderRawMarkdownHtmlValueIntoElement(element, '<!--注释-->');

    expect(element.classList.contains('md-htmlblock-literal-text')).toBe(true);
    expect(element.dataset.value).toBe('<!--注释-->');
    expect(element.childNodes).toHaveLength(1);
    expect(element.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
    expect(element.textContent).toBe('<!--注释-->');
  });

  it('keeps raw markdown html rendered as html unless it is an authored comment', () => {
    const element = document.createElement('div');

    renderRawMarkdownHtmlValueIntoElement(element, '<strong>HTML</strong>');

    expect(element.classList.contains('md-htmlblock-literal-text')).toBe(false);
    expect(element.querySelector('strong')?.textContent).toBe('HTML');

    renderRawMarkdownHtmlValueIntoElement(element, '<!--vlaina-markdown-blank-line-->');

    expect(element.classList.contains('md-htmlblock-literal-text')).toBe(false);
    expect(element.textContent).toBe('');
  });

  it('sanitizes unsafe raw markdown HTML values', () => {
    expect(sanitizeRawMarkdownHtmlValue('<img src="javascript:alert(1)" onerror="alert(1)">')).toBe('<img>');
  });

  it('drops oversized non-rendering raw markdown HTML before bypassing the sanitizer', () => {
    const value = `<!--${'x'.repeat(2 * 1024 * 1024)}-->`;

    expect(sanitizeRawMarkdownHtmlValue(value)).toBe('');
  });
});
