import { describe, expect, it, vi } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import {
  MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES,
  createEditableMarkdownBlankLineDecorations,
  findEditableMarkdownBlankLineElement,
  isEditableMarkdownBlankLineNode,
  resolveMarkdownBlankLineTargetAtCoords,
  resolveMarkdownBlankLineNodePos,
} from './markdownBlankLineInteraction';

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm);

  await editor.create();
  return editor;
}

describe('markdownBlankLineInteraction', () => {
  it('caches editable markdown blank line decorations for the same doc instance', async () => {
    const editor = await createEditor('Alpha');
    const view = editor.ctx.get(editorViewCtx);

    const first = createEditableMarkdownBlankLineDecorations(view.state.doc);
    const second = createEditableMarkdownBlankLineDecorations(view.state.doc);

    expect(second).toBe(first);

    await editor.destroy();
  });

  it('detects editable blank line nodes without aggregating paragraph textContent', () => {
    const paragraph = {
      content: { size: EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length },
      nodeSize: 3,
      textBetween: vi.fn(() => EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER),
      type: { name: 'paragraph' },
      get textContent() {
        throw new Error('aggregate paragraph textContent should not be read');
      },
    };

    expect(isEditableMarkdownBlankLineNode(paragraph)).toBe(true);
    expect(paragraph.textBetween).toHaveBeenCalledWith(0, EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length, '\0', '\0');
  });

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

  it('resolves pointer-events-none markdown blank line targets by click coordinates', () => {
    const root = document.createElement('div');
    const firstBlankLine = document.createElement('div');
    firstBlankLine.setAttribute('data-type', 'html-block');
    firstBlankLine.setAttribute('data-value', MARKDOWN_BLANK_LINE_VALUE);
    const secondBlankLine = document.createElement('div');
    secondBlankLine.setAttribute('data-type', 'html-block');
    secondBlankLine.setAttribute('data-value', MARKDOWN_BLANK_LINE_VALUE);
    root.append(firstBlankLine, secondBlankLine);
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getRect(this: HTMLElement) {
      if (this === firstBlankLine) {
        return {
          x: 10,
          y: 20,
          top: 20,
          left: 10,
          right: 310,
          bottom: 44,
          width: 300,
          height: 24,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if (this === secondBlankLine) {
        return {
          x: 10,
          y: 60,
          top: 60,
          left: 10,
          right: 310,
          bottom: 84,
          width: 300,
          height: 24,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });

    try {
      expect(resolveMarkdownBlankLineTargetAtCoords({ dom: root } as any, 120, 32)).toBe(firstBlankLine);
      expect(resolveMarkdownBlankLineTargetAtCoords({ dom: root } as any, 120, 72)).toBe(secondBlankLine);
      expect(resolveMarkdownBlankLineTargetAtCoords({ dom: root } as any, 120, 120)).toBeNull();
    } finally {
      rectSpy.mockRestore();
    }
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

  it('caps fallback blank line node position scans by node count', () => {
    const blankLine = document.createElement('div');
    let accessed = 0;
    const doc = {
      child(index: number) {
        accessed += 1;
        if (index < MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES) {
          return {
            attrs: {},
            nodeSize: 1,
            type: { name: 'paragraph' },
          };
        }
        return {
          attrs: { value: MARKDOWN_BLANK_LINE_VALUE },
          nodeSize: 1,
          type: { name: 'html_block' },
        };
      },
      childCount: MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES + 1,
      nodeAt: vi.fn(),
    };
    const view = {
      nodeDOM: vi.fn(() => blankLine),
      posAtDOM: vi.fn(() => {
        throw new Error('Force fallback scan');
      }),
      state: { doc },
    };

    expect(resolveMarkdownBlankLineNodePos(view as any, blankLine)).toBeNull();
    expect(accessed).toBe(MAX_MARKDOWN_BLANK_LINE_NODE_POS_SCAN_NODES);
    expect(view.nodeDOM).not.toHaveBeenCalled();
  });
});
