import { describe, expect, it } from 'vitest';
import { applyTocShortcutsToTree, type TocMdastNode } from './tocMarkdown';
import {
  MAX_MARKDOWN_AST_NODES,
  countMarkdownAstNodes,
} from './markdownAstBudget';
import { translate } from '@/lib/i18n';

function textParagraph(value: string): TocMdastNode {
  return {
    type: 'paragraph',
    children: [{ type: 'text', value }],
  };
}

function heading(value: string, depth = 2): TocMdastNode {
  return {
    type: 'heading',
    depth,
    children: [{ type: 'text', value }],
  };
}

function getTocItems(tocNode: TocMdastNode | undefined): TocMdastNode[] {
  return tocNode?.children?.[0].children?.[0].children ?? [];
}

describe('tocMarkdown', () => {
  it('replaces TOC shortcuts with heading links', () => {
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        textParagraph('[TOC]'),
        heading('Alpha', 2),
        heading('Beta', 3),
      ],
    };

    applyTocShortcutsToTree(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'container',
      data: {
        hName: 'div',
        hProperties: {
          className: ['toc-block'],
          dataType: 'toc',
        },
      },
    });
    expect(getTocItems(tree.children?.[0])).toHaveLength(2);
    expect(tree.children?.[1].data?.hProperties?.id).toBe('heading-alpha-1');
    expect(tree.children?.[2].data?.hProperties?.id).toBe('heading-beta-2');
  });

  it('caps generated TOC heading items while still assigning heading ids', () => {
    const headings = Array.from({ length: 520 }, (_, index) => heading(`Heading ${index}`));
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        textParagraph('[TOC]'),
        ...headings,
      ],
    };

    applyTocShortcutsToTree(tree);

    expect(getTocItems(tree.children?.[0])).toHaveLength(512);
    expect(tree.children?.[512].data?.hProperties?.id).toBe('heading-heading-511-512');
    expect(tree.children?.[513].data?.hProperties?.id).toBe('heading-heading-512-513');
    expect(tree.children?.[520].data?.hProperties?.id).toBe('heading-heading-519-520');
  });

  it('caps generated TOC blocks and leaves later shortcuts as text', () => {
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        ...Array.from({ length: 10 }, () => textParagraph('[TOC]')),
        heading('Alpha'),
      ],
    };

    applyTocShortcutsToTree(tree);

    expect(tree.children?.filter((child) => child.data?.hProperties?.dataType === 'toc')).toHaveLength(8);
    expect(tree.children?.[8]).toEqual(textParagraph('[TOC]'));
    expect(tree.children?.[9]).toEqual(textParagraph('[TOC]'));
  });

  it('uses the localized empty text when there are no headings', () => {
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        textParagraph('[TOC]'),
      ],
    };

    applyTocShortcutsToTree(tree);

    expect(tree.children?.[0].children?.[0].children?.[0].children?.[0]).toEqual({
      type: 'text',
      value: translate('editor.tocEmpty'),
    });
  });

  it('does not trim overlong text nodes while matching TOC shortcuts', () => {
    const oversizedShortcut = textParagraph(`${' '.repeat(65)}[TOC]`);
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        oversizedShortcut,
        heading('Alpha'),
      ],
    };

    applyTocShortcutsToTree(tree);

    expect(tree.children?.[0]).toBe(oversizedShortcut);
  });

  it('bounds TOC heading text copied into links', () => {
    const longHeading = 'A'.repeat(260);
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        textParagraph('[TOC]'),
        heading(longHeading),
      ],
    };

    applyTocShortcutsToTree(tree);

    const firstItem = getTocItems(tree.children?.[0])[0];
    expect(firstItem.children?.[0].children?.[0]).toEqual({
      type: 'text',
      value: 'A'.repeat(240),
    });
  });

  it('skips TOC replacement when the AST growth budget is exhausted', () => {
    const tocShortcut = textParagraph('[TOC]');
    const alphaHeading = heading('Alpha');
    const tree: TocMdastNode = {
      type: 'root',
      children: [
        tocShortcut,
        alphaHeading,
        ...Array.from({ length: MAX_MARKDOWN_AST_NODES - 8 }, (_, index) => ({
          type: 'text',
          value: String(index),
        })),
      ],
    };

    applyTocShortcutsToTree(tree);

    expect(tree.children?.[0]).toBe(tocShortcut);
    expect(alphaHeading.data?.hProperties?.id).toBe('heading-alpha-1');
    expect(countMarkdownAstNodes(tree)).toBeLessThanOrEqual(MAX_MARKDOWN_AST_NODES);
  });
});
