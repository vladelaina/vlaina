import { describe, expect, it } from 'vitest';
import {
  MAX_INLINE_HTML_CONTAINER_CHILDREN,
  remarkNotesInlineExtensions,
  type MdastNode,
} from './remarkNotesExtensions';

function buildDeepTree(leafChildren: MdastNode[]): {
  leaf: MdastNode;
  tree: MdastNode;
} {
  const leaf: MdastNode = {
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

describe('remarkNotesInlineExtensions', () => {
  it('parses split inline color html with CSS declaration whitespace', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'html', value: '<span style="font-weight: 600; color : #123456">' },
            { type: 'text', value: 'red' },
            { type: 'text', value: ' text' },
            { type: 'html', value: '</span>' },
            { type: 'text', value: ' ' },
            { type: 'html', value: '<mark style="border-radius: 2px; background-color : #ecf6ff">' },
            { type: 'text', value: 'marked' },
            { type: 'text', value: ' text' },
            { type: 'html', value: '</mark>' },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children?.[0]).toMatchObject({
      type: 'textColor',
      color: '#123456',
      children: [
        { type: 'text', value: 'red' },
        { type: 'text', value: ' text' },
      ],
    });
    expect(paragraph?.children?.[2]).toMatchObject({
      type: 'bgColor',
      color: '#ecf6ff',
      children: [
        { type: 'text', value: 'marked' },
        { type: 'text', value: ' text' },
      ],
    });
  });

  it('keeps nested raw html inside inline color containers as html', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'html', value: '<span style="color : #123456">' },
            { type: 'text', value: '&lt;em&gt;nested&lt;/em&gt;' },
            { type: 'html', value: '</span>' },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children).toEqual([
      { type: 'html', value: '<span style="color : #123456">' },
      { type: 'text', value: '&lt;em&gt;nested&lt;/em&gt;' },
      { type: 'html', value: '</span>' },
    ]);
  });

  it('keeps nested raw html inside simple inline html marks as html', () => {
    const children: MdastNode[] = [
      { type: 'html', value: '<mark><em>nested</em></mark>' },
      { type: 'text', value: ' ' },
      { type: 'html', value: '<sup>' },
      { type: 'text', value: '&lt;em&gt;encoded&lt;/em&gt;' },
      { type: 'html', value: '</sup>' },
    ];
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [...children],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    expect(tree.children?.[0].children).toEqual(children);
  });

  it('transforms bounded callout icon markers', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: '[!callout-icon:img%3Aicons%2Fdemo.png] Body' }],
            },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const callout = tree.children?.[0];
    expect(callout).toMatchObject({
      type: 'container',
      data: {
        hName: 'div',
        hProperties: {
          className: ['callout', 'callout-yellow'],
          dataType: 'callout',
        },
      },
    });
    expect(callout?.children?.[0]).toMatchObject({
      data: { hProperties: { className: ['callout-icon'] } },
      children: [{ type: 'text', value: 'img:icons/demo.png' }],
    });
    expect(callout?.children?.[1].children?.[0].children?.[0]).toMatchObject({
      type: 'text',
      value: 'Body',
    });
  });

  it('ignores oversized callout icon markers', () => {
    const oversizedMarker = `[!callout-icon:${'a'.repeat(4097)}] Body`;
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', value: oversizedMarker }],
            },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'blockquote',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: oversizedMarker }],
        },
      ],
    });
  });

  it('keeps unclosed inline html containers from blocking valid sibling containers', () => {
    const unclosedSuperscriptTags = Array.from(
      { length: 500 },
      () => ({ type: 'html', value: '<sup>' } satisfies MdastNode),
    );
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            ...unclosedSuperscriptTags,
            { type: 'text', value: 'plain' },
            { type: 'html', value: '<sub>' },
            { type: 'text', value: 'sub' },
            { type: 'html', value: '</sub>' },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children?.slice(0, 500)).toEqual(unclosedSuperscriptTags);
    expect(paragraph?.children?.at(-1)).toMatchObject({
      type: 'subscript',
      children: [{ type: 'text', value: 'sub' }],
    });
  });

  it('keeps oversized inline html containers raw instead of scanning every sibling', () => {
    const longContent = Array.from(
      { length: MAX_INLINE_HTML_CONTAINER_CHILDREN + 1 },
      (_, index) => ({ type: 'text', value: `part-${index}` } satisfies MdastNode),
    );
    const tree: MdastNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'html', value: '<sup>' },
            ...longContent,
            { type: 'html', value: '</sup>' },
            { type: 'html', value: '<sub>' },
            { type: 'text', value: 'sub' },
            { type: 'html', value: '</sub>' },
          ],
        },
      ],
    };

    remarkNotesInlineExtensions()(tree);

    const paragraph = tree.children?.[0];
    expect(paragraph?.children?.[0]).toEqual({ type: 'html', value: '<sup>' });
    expect(paragraph?.children?.[MAX_INLINE_HTML_CONTAINER_CHILDREN + 2]).toEqual({
      type: 'html',
      value: '</sup>',
    });
    expect(paragraph?.children?.at(-1)).toMatchObject({
      type: 'subscript',
      children: [{ type: 'text', value: 'sub' }],
    });
  });

  it('skips inline transformations on over-deep trees', () => {
    const leafChildren: MdastNode[] = [{ type: 'text', value: 'plain ==marked== text' }];
    const { leaf, tree } = buildDeepTree(leafChildren);

    remarkNotesInlineExtensions()(tree);

    expect(leaf.children).toEqual(leafChildren);
  });
});
