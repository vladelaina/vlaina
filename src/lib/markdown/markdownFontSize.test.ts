import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMarkdownFontSize,
  MARKDOWN_FONT_SIZE_STYLE_ID,
} from './markdownFontSize';

describe('applyMarkdownFontSize', () => {
  afterEach(() => {
    document.getElementById(MARKDOWN_FONT_SIZE_STYLE_ID)?.remove();
    document.documentElement.style.removeProperty('--vlaina-markdown-font-size');
    vi.restoreAllMocks();
  });

  it('does not invalidate root styles when the scoped font size is unchanged', () => {
    applyMarkdownFontSize(18);
    const removePropertySpy = vi.spyOn(document.documentElement.style, 'removeProperty');

    applyMarkdownFontSize(18);

    expect(removePropertySpy).not.toHaveBeenCalled();
    expect(document.getElementById(MARKDOWN_FONT_SIZE_STYLE_ID)?.textContent).toContain(
      '--vlaina-markdown-font-body-size: 18px',
    );
  });

  it('clears legacy root font size variables even when the scoped size is unchanged', () => {
    applyMarkdownFontSize(18);
    document.documentElement.style.setProperty('--vlaina-markdown-font-size', '18px');
    const removePropertySpy = vi.spyOn(document.documentElement.style, 'removeProperty');

    applyMarkdownFontSize(18);

    expect(removePropertySpy).toHaveBeenCalledWith('--vlaina-markdown-font-size');
    expect(document.documentElement.style.getPropertyValue('--vlaina-markdown-font-size')).toBe('');
  });
});
