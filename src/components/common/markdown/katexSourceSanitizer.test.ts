import { describe, expect, it } from 'vitest';
import { removeKatexSourceAnnotationsFromHast } from './katexSourceSanitizer';

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
});
