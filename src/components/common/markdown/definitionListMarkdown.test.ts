import { describe, expect, it } from 'vitest';
import { applyDefinitionListsToTree, type DefinitionListMdastNode } from './definitionListMarkdown';
import {
  MAX_MARKDOWN_AST_NODES,
  countMarkdownAstNodes,
} from './markdownAstBudget';

function paragraph(children: DefinitionListMdastNode[]): DefinitionListMdastNode {
  return {
    type: 'paragraph',
    children,
  };
}

function text(value: string): DefinitionListMdastNode {
  return {
    type: 'text',
    value,
  };
}

describe('definitionListMarkdown', () => {
  it('converts adjacent term and description paragraphs', () => {
    const tree: DefinitionListMdastNode = {
      type: 'root',
      children: [
        paragraph([text('Term')]),
        paragraph([text(': Definition')]),
      ],
    };

    applyDefinitionListsToTree(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'definitionList',
      data: {
        hName: 'dl',
        hProperties: { className: ['definition-list'] },
      },
      children: [
        {
          type: 'definitionTerm',
          children: [{ type: 'text', value: 'Term' }],
        },
        {
          type: 'definitionDescription',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: 'Definition' }],
            },
          ],
        },
      ],
    });
  });

  it('recognizes description prefixes split across text nodes', () => {
    const tree: DefinitionListMdastNode = {
      type: 'root',
      children: [
        paragraph([text('Term')]),
        paragraph([text(':'), text(' Definition')]),
      ],
    };

    applyDefinitionListsToTree(tree);

    expect(tree.children?.[0].type).toBe('definitionList');
    expect(tree.children?.[0].children?.[1].children?.[0].children).toEqual([
      { type: 'text', value: '' },
      { type: 'text', value: 'Definition' },
    ]);
  });

  it('removes description marker whitespace split across text nodes', () => {
    const tree: DefinitionListMdastNode = {
      type: 'root',
      children: [
        paragraph([text('Term')]),
        paragraph([text('  :  '), text('Definition')]),
      ],
    };

    applyDefinitionListsToTree(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'definitionList',
      children: [
        {
          type: 'definitionTerm',
          children: [{ type: 'text', value: 'Term' }],
        },
        {
          type: 'definitionDescription',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', value: '' },
                { type: 'text', value: 'Definition' },
              ],
            },
          ],
        },
      ],
    });
  });

  it('does not convert oversized term paragraphs', () => {
    const longTerm = 'A'.repeat(80);
    const tree: DefinitionListMdastNode = {
      type: 'root',
      children: [
        paragraph([text(longTerm)]),
        paragraph([text(': Definition')]),
      ],
    };

    applyDefinitionListsToTree(tree);

    expect(tree.children).toEqual([
      paragraph([text(longTerm)]),
      paragraph([text(': Definition')]),
    ]);
  });

  it('skips definition-list conversion when the AST growth budget is exhausted', () => {
    const term = paragraph([text('Term')]);
    const description = paragraph([text(': Definition')]);
    const tree: DefinitionListMdastNode = {
      type: 'root',
      children: [
        ...Array.from({ length: MAX_MARKDOWN_AST_NODES - 6 }, (_, index) => text(String(index))),
        term,
        description,
      ],
    };

    applyDefinitionListsToTree(tree);

    expect(tree.children?.at(-2)).toBe(term);
    expect(tree.children?.at(-1)).toBe(description);
    expect(countMarkdownAstNodes(tree)).toBeLessThanOrEqual(MAX_MARKDOWN_AST_NODES);
  });
});
