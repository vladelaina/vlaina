import { describe, expect, it } from 'vitest';
import {
  replaceInlineColorHtmlMark,
  replaceUnderlineMarkdown,
  type ColorMarkdownMdastNode,
} from './colorMarkdown';

function buildDeepTree(leafChildren: ColorMarkdownMdastNode[]): {
  leaf: ColorMarkdownMdastNode;
  tree: ColorMarkdownMdastNode;
} {
  const leaf: ColorMarkdownMdastNode = {
    type: 'paragraph',
    children: leafChildren,
  };
  let current = leaf;

  for (let index = 0; index < 205; index += 1) {
    current = {
      type: 'container',
      children: [current],
    };
  }

  return {
    leaf,
    tree: {
      type: 'root',
      children: [current],
    },
  };
}

describe('colorMarkdown', () => {
  it('parses inline color html marks', () => {
    const tree: ColorMarkdownMdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'html', value: '<span style="font-weight: 600; color: #123456">text</span>' }],
        },
      ],
    };

    replaceInlineColorHtmlMark(tree);

    expect(tree.children?.[0].children?.[0]).toMatchObject({
      type: 'textColor',
      color: '#123456',
      children: [{ type: 'text', value: 'text' }],
    });
  });

  it('parses underline markdown', () => {
    const tree: ColorMarkdownMdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'plain ++underlined++ text' }],
        },
      ],
    };

    replaceUnderlineMarkdown(tree);

    expect(tree.children?.[0].children).toEqual([
      { type: 'text', value: 'plain ' },
      {
        type: 'underline',
        children: [{ type: 'text', value: 'underlined' }],
        data: { hName: 'u', hProperties: { className: ['underline'] } },
      },
      { type: 'text', value: ' text' },
    ]);
  });

  it('skips inline color html conversion on over-deep trees', () => {
    const leafChildren = [{ type: 'html', value: '<mark style="background-color: #abcdef">text</mark>' }];
    const { leaf, tree } = buildDeepTree(leafChildren);

    replaceInlineColorHtmlMark(tree);

    expect(leaf.children).toEqual(leafChildren);
  });

  it('skips underline conversion on over-deep trees', () => {
    const leafChildren = [{ type: 'text', value: '++underlined++' }];
    const { leaf, tree } = buildDeepTree(leafChildren);

    replaceUnderlineMarkdown(tree);

    expect(leaf.children).toEqual(leafChildren);
  });
});
