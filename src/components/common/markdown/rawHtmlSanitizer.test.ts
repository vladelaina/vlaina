import { describe, expect, it } from 'vitest';
import { dropUnsafeRawHtmlContent } from './rawHtmlSanitizer';

function stringify(value: unknown) {
  return JSON.stringify(value);
}

describe('rawHtmlSanitizer', () => {
  it('drops unsafe raw html without recursive traversal', () => {
    const tree = { type: 'root', children: [] as any[] };
    let current = tree;
    for (let index = 0; index < 250; index += 1) {
      const child = { type: 'element', tagName: 'div', children: [] as any[] };
      current.children.push(child);
      current = child;
    }
    current.children.push({ type: 'raw', value: '<script>alert(1)</script>' });

    expect(() => dropUnsafeRawHtmlContent(tree)).not.toThrow();
    expect(stringify(tree)).not.toContain('<script');
  });

  it('keeps nested dropped raw html containers active across siblings', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'raw', value: '<svg><svg><img src="https://example.com/hidden.png"></svg>' },
        { type: 'raw', value: '<img src="https://example.com/leaked.png"></svg>' },
        { type: 'raw', value: '<img src="https://example.com/real.png">' },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('hidden.png');
    expect(stringify(tree)).not.toContain('leaked.png');
    expect(stringify(tree)).toContain('real.png');
  });

  it('ignores raw html close tags inside comments while dropping containers', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'raw',
          value: [
            '<svg>',
            '<!-- </svg> -->',
            '<img src="https://example.com/leaked.png">',
            '</svg>',
            '<img src="https://example.com/real.png">',
          ].join(''),
        },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('leaked.png');
    expect(stringify(tree)).toContain('real.png');
  });

  it('keeps dropped raw html containers active across nested parent boundaries', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'p',
          children: [
            { type: 'raw', value: '<svg><svg><img src="https://example.com/hidden.png"></svg>' },
          ],
        },
        {
          type: 'element',
          tagName: 'p',
          children: [
            { type: 'raw', value: '<img src="https://example.com/leaked.png"></svg>' },
          ],
        },
        {
          type: 'element',
          tagName: 'p',
          children: [
            { type: 'raw', value: '<img src="https://example.com/real.png">' },
          ],
        },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('hidden.png');
    expect(stringify(tree)).not.toContain('leaked.png');
    expect(stringify(tree)).toContain('real.png');
  });

  it('drops non-raw child containers while raw html content is active', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'raw', value: '<svg>' },
        {
          type: 'element',
          tagName: 'span',
          children: [{ type: 'text', value: 'hidden' }],
        },
        { type: 'raw', value: '</svg><img src="https://example.com/real.png">' },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('hidden');
    expect(stringify(tree)).not.toContain('span');
    expect(stringify(tree)).toContain('real.png');
  });

  it('unwraps parser-promoted containers entered while raw html content is active', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'raw', value: '<svg>' },
        {
          type: 'element',
          tagName: 'span',
          children: [
            { type: 'raw', value: '</svg><img src="https://example.com/real.png">' },
          ],
        },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('span');
    expect(stringify(tree)).toContain('real.png');
  });

  it('keeps malformed dropped raw html containers active across raw siblings', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'raw', value: '<svg <img src="https://example.com/hidden.png">' },
        { type: 'raw', value: '<img src="https://example.com/leaked.png"></svg>' },
        { type: 'raw', value: '<img src="https://example.com/real.png">' },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('hidden.png');
    expect(stringify(tree)).not.toContain('leaked.png');
    expect(stringify(tree)).toContain('real.png');
  });

  it('caps pathological raw html HAST node counts', () => {
    const tree = {
      type: 'root',
      children: Array.from({ length: 20_050 }, () => ({ type: 'element', tagName: 'span' })),
    };

    dropUnsafeRawHtmlContent(tree);

    expect(tree.children.length).toBeLessThanOrEqual(20_000);
  });

  it('counts dropped raw html nodes toward the traversal budget', () => {
    const tree = {
      type: 'root',
      children: [
        ...Array.from({ length: 20_050 }, () => ({ type: 'raw', value: '<script>alert(1)</script>' })),
        { type: 'raw', value: '<img src="https://example.com/after-budget.png">' },
      ],
    };

    dropUnsafeRawHtmlContent(tree);

    expect(stringify(tree)).not.toContain('after-budget.png');
  });
});
