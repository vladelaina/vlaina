import { describe, expect, it } from 'vitest';

import { canTransformMarkdownAst } from './markdownAstBudget';

function createDeepTree(depth: number): any {
  let current: any = { type: 'text', value: 'leaf' };

  for (let index = 0; index < depth; index += 1) {
    current = {
      type: 'container',
      children: [current],
    };
  }

  return current;
}

describe('markdownAstBudget', () => {
  it('allows ordinary markdown ASTs', () => {
    expect(canTransformMarkdownAst({
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'hello' }],
        },
      ],
    })).toBe(true);
  });

  it('rejects over-deep markdown ASTs without recursive traversal', () => {
    expect(canTransformMarkdownAst(createDeepTree(201))).toBe(false);
  });

  it('rejects over-large sibling lists before scheduling every child', () => {
    expect(canTransformMarkdownAst({
      type: 'root',
      children: Array.from({ length: 20_001 }, (_, index) => ({
        type: 'text',
        value: String(index),
      })),
    })).toBe(false);
  });
});
