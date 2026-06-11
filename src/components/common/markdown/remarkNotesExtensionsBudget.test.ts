import { describe, expect, it } from 'vitest';
import {
  MAX_MARKDOWN_AST_NODES,
  countMarkdownAstNodes,
} from './markdownAstBudget';
import { remarkNotesInlineExtensions, type MdastNode } from './remarkNotesExtensions';

function textNode(value: string): MdastNode {
  return { type: 'text', value };
}

describe('remarkNotesInlineExtensions AST budget', () => {
  it('skips delimiter expansion when the AST growth budget is exhausted', () => {
    const target = textNode('==a== ==a== ==a== ==a== ==a==');
    const tree: MdastNode = {
      type: 'root',
      children: [{
        type: 'paragraph',
        children: [
          ...Array.from({ length: MAX_MARKDOWN_AST_NODES - 8 }, (_, index) => textNode(String(index))),
          target,
        ],
      }],
    };

    expect(countMarkdownAstNodes(tree)).toBeLessThanOrEqual(MAX_MARKDOWN_AST_NODES);

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children?.at(-1)).toBe(target);
    expect(countMarkdownAstNodes(tree)).toBeLessThanOrEqual(MAX_MARKDOWN_AST_NODES);
  });
});
