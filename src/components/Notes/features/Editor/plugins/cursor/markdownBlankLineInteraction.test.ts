import { describe, expect, it, vi } from 'vitest';
import {
  findEditableMarkdownBlankLineElement,
  resolveMarkdownBlankLineNodePos,
} from './markdownBlankLineInteraction';

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';

describe('markdown blank line interaction helpers', () => {
  it('finds editable blank line paragraphs without materializing all root children', () => {
    const root = document.createElement('div');
    root.appendChild(document.createElement('div'));
    const blankLine = document.createElement('p');
    blankLine.textContent = EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER;
    root.appendChild(blankLine);

    const arrayFrom = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used for root children');
    });

    const result = findEditableMarkdownBlankLineElement(root);
    arrayFrom.mockRestore();

    expect(result).toBe(blankLine);
  });

  it('stops fallback document scanning after resolving the matching blank line DOM node', () => {
    const blankLine = document.createElement('div');
    const otherBlankLine = document.createElement('div');
    const accessedChildren: number[] = [];
    const nodes = [
      {
        attrs: {},
        nodeSize: 2,
        type: { name: 'paragraph' },
      },
      {
        attrs: { value: MARKDOWN_BLANK_LINE_VALUE },
        nodeSize: 1,
        type: { name: 'html_block' },
      },
      {
        attrs: { value: MARKDOWN_BLANK_LINE_VALUE },
        nodeSize: 1,
        type: { name: 'html_block' },
      },
    ];
    const doc = {
      child(index: number) {
        accessedChildren.push(index);
        if (index >= 2) {
          throw new Error('Document scan should stop after the matching node');
        }
        return nodes[index];
      },
      childCount: nodes.length,
      nodeAt: vi.fn(),
    };
    const view = {
      nodeDOM(pos: number) {
        return pos === 2 ? blankLine : otherBlankLine;
      },
      posAtDOM: vi.fn(() => {
        throw new Error('Force fallback scan');
      }),
      state: { doc },
    };

    expect(resolveMarkdownBlankLineNodePos(view as any, blankLine)).toBe(2);
    expect(accessedChildren).toEqual([0, 1]);
  });
});
