import { describe, expect, it, vi } from 'vitest';
import { removeKatexSourceAnnotationsFromHtml } from './katexSourceSanitizer';

describe('katexSourceSanitizer', () => {
  it('removes oversized KaTeX HTML annotations without DOM parsing', () => {
    const createElementSpy = vi.spyOn(document, 'createElement');
    const html = `${'x'.repeat((2 * 1024 * 1024) + 1)}<annotation encoding="application/x-tex">secret</annotation>`;

    try {
      const sanitized = removeKatexSourceAnnotationsFromHtml(html);

      expect(sanitized).not.toContain('application/x-tex');
      expect(sanitized).not.toContain('secret');
      expect(createElementSpy).not.toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('removes HTML source annotations case-insensitively', () => {
    const html = '<span><annotation encoding="APPLICATION/X-TEX">secret</annotation><span>visible</span></span>';

    const sanitized = removeKatexSourceAnnotationsFromHtml(html);

    expect(sanitized).toContain('visible');
    expect(sanitized).not.toContain('APPLICATION/X-TEX');
    expect(sanitized).not.toContain('secret');
  });

  it('falls back when HTML source annotation DOM scanning exceeds the node budget', () => {
    const html = [
      '<span>',
      Array.from({ length: 20_050 }, (_, index) => `<i>${index}</i>`).join(''),
      '<annotation encoding=application/x-tex>secret</annotation>',
      '</span>',
    ].join('');

    const sanitized = removeKatexSourceAnnotationsFromHtml(html);

    expect(sanitized).not.toContain('application/x-tex');
    expect(sanitized).not.toContain('secret');
  });

  it('removes HTML source annotations without materializing selector results', () => {
    const querySelectorAllSpy = vi.spyOn(DocumentFragment.prototype, 'querySelectorAll');
    const html = '<span><annotation encoding="application/x-tex">secret</annotation><span>visible</span></span>';

    try {
      const sanitized = removeKatexSourceAnnotationsFromHtml(html);

      expect(sanitized).toContain('visible');
      expect(sanitized).not.toContain('application/x-tex');
      expect(sanitized).not.toContain('secret');
      expect(querySelectorAllSpy).not.toHaveBeenCalled();
    } finally {
      querySelectorAllSpy.mockRestore();
    }
  });
});
