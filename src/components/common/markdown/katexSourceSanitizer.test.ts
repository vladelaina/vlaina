import { describe, expect, it, vi } from 'vitest';
import {
  removeKatexSourceAnnotationsFromHast,
  removeKatexSourceAnnotationsFromHtml,
} from './katexSourceSanitizer';

function stringify(value: unknown) {
  return JSON.stringify(value);
}

describe('katexSourceSanitizer', () => {
  it('removes source annotations without recursive traversal', () => {
    const tree = { type: 'root', children: [] as any[] };
    let current = tree;
    for (let index = 0; index < 250; index += 1) {
      const child = { type: 'element', tagName: 'span', children: [] as any[] };
      current.children.push(child);
      current = child;
    }
    current.children.push({
      type: 'element',
      tagName: 'annotation',
      properties: { encoding: 'application/x-tex' },
      children: [{ type: 'text', value: 'secret' }],
    });

    expect(() => removeKatexSourceAnnotationsFromHast(tree)).not.toThrow();
    expect(stringify(tree)).not.toContain('application/x-tex');
    expect(stringify(tree)).not.toContain('secret');
  });

  it('caps pathological source annotation HAST node counts', () => {
    const tree = {
      type: 'root',
      children: Array.from({ length: 20_050 }, () => ({ type: 'element', tagName: 'span' })),
    };

    removeKatexSourceAnnotationsFromHast(tree);

    expect(tree.children.length).toBeLessThanOrEqual(20_000);
  });

  it('ignores non-string HAST annotation encodings without coercion', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'annotation',
          properties: {
            encoding: {
              toString: () => {
                throw new Error('Unexpected annotation encoding coercion');
              },
            },
          },
          children: [{ type: 'text', value: 'visible' }],
        },
      ],
    };

    expect(() => removeKatexSourceAnnotationsFromHast(tree)).not.toThrow();
    expect(stringify(tree)).toContain('visible');
  });

  it('ignores oversized HAST annotation encoding arrays', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'annotation',
          properties: {
            encoding: ['application/x-tex', 'x'.repeat(129)],
          },
          children: [{ type: 'text', value: 'visible' }],
        },
      ],
    };

    removeKatexSourceAnnotationsFromHast(tree);

    expect(stringify(tree)).toContain('visible');
  });

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
