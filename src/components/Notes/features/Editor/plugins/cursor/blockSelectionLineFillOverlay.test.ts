import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { EditorView } from '@milkdown/kit/prose/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankAreaDragBoxPlugin } from './blankAreaDragBoxPlugin';
import { dispatchBlockSelectionAction } from './blockSelectionPluginState';
import {
  collectRangeRows,
  collectSelectedHardBreakLineRanges,
  MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS,
  MAX_BLOCK_SELECTION_LINE_FILL_RANGES,
} from './blockSelectionLineFillOverlay';
import { LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD } from './blockSelectionUtils';

async function createEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .use(gfm)
    .use(blankAreaDragBoxPlugin);

  await editor.create();
  return editor;
}

function selectWholeDocument(view: EditorView) {
  dispatchBlockSelectionAction(view, {
    type: 'set-blocks',
    blocks: [{ from: 0, to: view.state.doc.content.size }],
  });
}

function getParagraphRanges(view: EditorView) {
  const ranges: Array<{ from: number; to: number }> = [];
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return true;
    ranges.push({ from: pos, to: pos + node.nodeSize });
    return false;
  });
  return ranges;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('blockSelectionLineFillOverlay', () => {
  it('collects range rows without materializing DOM rect lists', () => {
    const dom = document.createElement('div');
    const rectIterator = vi.fn(() => {
      throw new Error('rects should not be iterated');
    });
    const createRangeSpy = vi.spyOn(document, 'createRange').mockReturnValue({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      getClientRects: () => ({
        length: 2,
        item: (index: number) => [
          {
            top: 20,
            right: 80,
            bottom: 40,
            height: 20,
          },
          {
            top: 22,
            right: 120,
            bottom: 42,
            height: 20,
          },
        ][index] as DOMRect | undefined ?? null,
        [Symbol.iterator]: rectIterator,
      }),
      detach: vi.fn(),
    } as unknown as Range);
    const view = {
      dom,
      domAtPos: vi.fn(() => ({ node: dom, offset: 0 })),
      state: {
        doc: {
          resolve: vi.fn(() => ({ nodeBefore: null })),
        },
      },
    };

    expect(collectRangeRows(view as any, { from: 1, to: 2 })).toEqual([
      { top: 20, right: 120, bottom: 42 },
    ]);
    expect(rectIterator).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('skips oversized range row rect lists without reading entries', () => {
    const dom = document.createElement('div');
    const item = vi.fn(() => {
      throw new Error('rect entries should not be read');
    });
    const rectIterator = vi.fn(() => {
      throw new Error('rects should not be iterated');
    });
    const createRangeSpy = vi.spyOn(document, 'createRange').mockReturnValue({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      getClientRects: () => ({
        length: MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS + 1,
        item,
        [Symbol.iterator]: rectIterator,
      }),
      detach: vi.fn(),
    } as unknown as Range);
    const view = {
      dom,
      domAtPos: vi.fn(() => ({ node: dom, offset: 0 })),
      state: {
        doc: {
          resolve: vi.fn(() => ({ nodeBefore: null })),
        },
      },
    };

    expect(collectRangeRows(view as any, { from: 1, to: 2 })).toEqual([]);
    expect(item).not.toHaveBeenCalled();
    expect(rectIterator).not.toHaveBeenCalled();

    createRangeSpy.mockRestore();
  });

  it('collects selected hard-break line ranges', async () => {
    const editor = await createEditor('alpha\\\nbravo\\\ncharlie');
    const view = editor.ctx.get(editorViewCtx);

    try {
      selectWholeDocument(view);

      expect(collectSelectedHardBreakLineRanges(view)).toEqual([
        { from: 1, to: 7 },
        { from: 7, to: 13 },
        { from: 13, to: 20 },
      ]);
    } finally {
      await editor.destroy();
    }
  });

  it('collects disjoint selected hard-break paragraphs', async () => {
    const editor = await createEditor([
      'alpha\\',
      'bravo',
      '',
      'plain middle paragraph',
      '',
      'charlie\\',
      'delta',
    ].join('\n'));
    const view = editor.ctx.get(editorViewCtx);

    try {
      const paragraphRanges = getParagraphRanges(view);
      expect(paragraphRanges).toHaveLength(3);

      dispatchBlockSelectionAction(view, {
        type: 'set-blocks',
        blocks: [paragraphRanges[0], paragraphRanges[2]],
      });

      expect(collectSelectedHardBreakLineRanges(view)).toHaveLength(4);
    } finally {
      await editor.destroy();
    }
  });

  it('caps selected hard-break line ranges before overlay measurement', async () => {
    const markdown = Array.from(
      { length: MAX_BLOCK_SELECTION_LINE_FILL_RANGES + 8 },
      (_, index) => `line-${index}\\`
    ).join('\n');
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);

    try {
      selectWholeDocument(view);

      expect(collectSelectedHardBreakLineRanges(view)).toHaveLength(MAX_BLOCK_SELECTION_LINE_FILL_RANGES);
    } finally {
      await editor.destroy();
    }
  });

  it('skips line-fill range collection for large block selections', async () => {
    const markdown = Array.from(
      { length: LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD },
      (_, index) => `line-${index}\\\nwrapped-${index}`
    ).join('\n\n');
    const editor = await createEditor(markdown);
    const view = editor.ctx.get(editorViewCtx);

    try {
      const paragraphRanges = getParagraphRanges(view);
      expect(paragraphRanges).toHaveLength(LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD);
      dispatchBlockSelectionAction(view, {
        type: 'set-blocks',
        blocks: paragraphRanges,
      });

      expect(collectSelectedHardBreakLineRanges(view)).toEqual([]);
    } finally {
      await editor.destroy();
    }
  });
});
