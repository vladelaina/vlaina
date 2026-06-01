import { afterEach, describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { Decoration } from '@milkdown/kit/prose/view';
import {
  clampViewportRectTop,
  convertBlockRectsToDocumentSpace,
  createBlockRectYIndex,
  convertViewportDragRectToDocumentRect,
  createBlockSelectionDecorations,
  createDragSelectionRect,
  getBlockSelectionDecorationClass,
  getDisplayBlockRangesForDecorations,
  getBlockRangesKey,
  isRectIntersecting,
  normalizeBlockRanges,
  preferNestedBlockRanges,
  preferNestedBlockRangesUnlessHeaderIntersects,
  pruneContainedBlockRanges,
  resolveDisplayedDragViewportRect,
  resolveIntersectedBlockRanges,
  resolveIntersectedBlockRangesFromYIndex,
  type BlockRect,
} from './blockSelectionUtils';

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

afterEach(() => {
  document.body.innerHTML = '';
});

describe('blockSelectionUtils', () => {
  it('normalizes drag rectangle in any direction', () => {
    expect(createDragSelectionRect(100, 80, 20, 10)).toEqual({
      left: 20,
      top: 10,
      right: 100,
      bottom: 80,
    });
  });

  it('requires positive overlap instead of selecting on touching edges', () => {
    expect(
      isRectIntersecting(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 10, top: 5, right: 20, bottom: 15 },
      ),
    ).toBe(false);

    expect(
      isRectIntersecting(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 9, top: 5, right: 20, bottom: 15 },
      ),
    ).toBe(true);
  });

  it('allows line-shaped drag selections only when they pass through block interiors', () => {
    const block = { left: 0, top: 0, right: 100, bottom: 20 };

    expect(
      isRectIntersecting(block, {
        left: 10,
        top: 10,
        right: 90,
        bottom: 10,
      }),
    ).toBe(true);

    expect(
      isRectIntersecting(block, {
        left: 50,
        top: 5,
        right: 50,
        bottom: 15,
      }),
    ).toBe(true);

    expect(
      isRectIntersecting(block, {
        left: 10,
        top: 20,
        right: 90,
        bottom: 20,
      }),
    ).toBe(false);
  });

  it('normalizes and deduplicates block ranges', () => {
    const ranges = normalizeBlockRanges([
      { from: 10, to: 20 },
      { from: 4, to: 8 },
      { from: 10, to: 20 },
      { from: 8, to: 8 },
    ]);

    expect(ranges).toEqual([
      { from: 4, to: 8 },
      { from: 10, to: 20 },
    ]);
  });

  it('drops ranges fully contained by an outer selected block', () => {
    expect(pruneContainedBlockRanges([
      { from: 0, to: 30 },
      { from: 8, to: 17 },
      { from: 18, to: 27 },
      { from: 30, to: 37 },
    ])).toEqual([
      { from: 0, to: 30 },
      { from: 30, to: 37 },
    ]);
  });

  it('prefers nested ranges when a child block and containing list item are both selected', () => {
    expect(preferNestedBlockRanges([
      { from: 22, to: 29 },
      { from: 26, to: 28 },
    ])).toEqual([{ from: 26, to: 28 }]);
  });

  it('keeps nested preference when a drag rect stays inside a selected child block', () => {
    const blocks: BlockRect[] = [
      { from: 26, to: 28, left: 0, top: 120, right: 100, bottom: 180 },
      { from: 22, to: 29, left: 0, top: 80, right: 100, bottom: 180 },
    ];

    expect(preferNestedBlockRangesUnlessHeaderIntersects(
      [
        { from: 22, to: 29 },
        { from: 26, to: 28 },
      ],
      blocks,
      { left: 0, top: 130, right: 100, bottom: 170 },
    )).toEqual([{ from: 26, to: 28 }]);
  });

  it('preserves a containing list item when dragging from a child block into its header area', () => {
    const blocks: BlockRect[] = [
      { from: 26, to: 28, left: 0, top: 120, right: 100, bottom: 180 },
      { from: 22, to: 29, left: 0, top: 80, right: 100, bottom: 180 },
    ];

    expect(preferNestedBlockRangesUnlessHeaderIntersects(
      [
        { from: 22, to: 29 },
        { from: 26, to: 28 },
      ],
      blocks,
      { left: 0, top: 90, right: 100, bottom: 170 },
    )).toEqual([{ from: 22, to: 29 }]);
  });

  it('converts drag rectangles into document space across scroll changes', () => {
    expect(
      convertViewportDragRectToDocumentRect(
        { left: 80, top: 120, right: 20, bottom: 40 },
        80,
        120,
        10,
        20,
        50,
        70,
      ),
    ).toEqual({ left: 70, top: 110, right: 90, bottom: 140 });

    expect(
      resolveDisplayedDragViewportRect(
        { left: 80, top: 120, right: 20, bottom: 40 },
        80,
        120,
        10,
        20,
        50,
        70,
      ),
    ).toEqual({ left: 20, top: 40, right: 40, bottom: 70 });
  });

  it('clamps displayed drag rectangles below the editor viewport top', () => {
    expect(clampViewportRectTop(
      { left: 20, top: -12, right: 80, bottom: 64 },
      40,
    )).toEqual({ left: 20, top: 40, right: 80, bottom: 64 });

    expect(clampViewportRectTop(
      { left: 20, top: -12, right: 80, bottom: 24 },
      40,
    )).toEqual({ left: 20, top: 40, right: 80, bottom: 40 });
  });

  it('converts block rects into document space', () => {
    expect(
      convertBlockRectsToDocumentSpace([{ from: 1, to: 2, left: 10, top: 20, right: 30, bottom: 40 }], 5, 7),
    ).toEqual([{ from: 1, to: 2, left: 15, top: 27, right: 35, bottom: 47 }]);

    expect(
      convertBlockRectsToDocumentSpace([
        {
          from: 1,
          to: 2,
          left: 10,
          top: 20,
          right: 80,
          bottom: 40,
          contentLeft: 30,
          contentRight: 50,
        },
      ], 5, 7),
    ).toEqual([
      {
        from: 1,
        to: 2,
        left: 15,
        top: 27,
        right: 85,
        bottom: 47,
        contentLeft: 35,
        contentRight: 55,
      },
    ]);
  });

  it('selects only intersected blocks and returns ordered ranges', () => {
    const blocks: BlockRect[] = [
      { from: 20, to: 30, left: 0, top: 70, right: 100, bottom: 90 },
      { from: 0, to: 10, left: 0, top: 0, right: 100, bottom: 20 },
      { from: 10, to: 20, left: 0, top: 30, right: 100, bottom: 50 },
    ];

    const result = resolveIntersectedBlockRanges(blocks, {
      left: 10,
      top: 10,
      right: 90,
      bottom: 75,
    });

    expect(result).toEqual([
      { from: 0, to: 10 },
      { from: 10, to: 20 },
      { from: 20, to: 30 },
    ]);
    expect(getBlockRangesKey(result)).toBe('0:10|10:20|20:30');
  });

  it('selects the same intersected blocks through the y-axis index', () => {
    const blocks: BlockRect[] = [
      { from: 20, to: 30, left: 0, top: 70, right: 100, bottom: 90 },
      { from: 0, to: 10, left: 0, top: 0, right: 100, bottom: 20 },
      { from: 10, to: 20, left: 0, top: 30, right: 100, bottom: 50 },
      { from: 30, to: 40, left: 0, top: 120, right: 100, bottom: 140 },
    ];
    const selectionRect = {
      left: 10,
      top: 10,
      right: 90,
      bottom: 75,
    };

    expect(resolveIntersectedBlockRangesFromYIndex(
      createBlockRectYIndex(blocks),
      selectionRect,
    )).toEqual(resolveIntersectedBlockRanges(blocks, selectionRect));
  });

  it('does not select the previous block when dragging from the gap below it', () => {
    const blocks: BlockRect[] = [
      { from: 0, to: 10, left: 0, top: 0, right: 100, bottom: 20 },
      { from: 10, to: 20, left: 0, top: 30, right: 100, bottom: 50 },
    ];

    expect(
      resolveIntersectedBlockRanges(blocks, {
        left: 10,
        top: 20,
        right: 90,
        bottom: 35,
      }),
    ).toEqual([{ from: 10, to: 20 }]);
  });

  it('matches common block drag selection gestures from surrounding blank space', () => {
    const blocks: BlockRect[] = [
      { from: 0, to: 10, left: 100, top: 0, right: 500, bottom: 24 },
      { from: 10, to: 20, left: 100, top: 36, right: 500, bottom: 60 },
      { from: 20, to: 30, left: 100, top: 72, right: 500, bottom: 96 },
    ];

    expect(resolveIntersectedBlockRanges(blocks, {
      left: 20,
      top: 8,
      right: 160,
      bottom: 44,
    })).toEqual([
      { from: 0, to: 10 },
      { from: 10, to: 20 },
    ]);

    expect(resolveIntersectedBlockRanges(blocks, {
      left: 20,
      top: 48,
      right: 160,
      bottom: 84,
    })).toEqual([
      { from: 10, to: 20 },
      { from: 20, to: 30 },
    ]);

    expect(resolveIntersectedBlockRanges(blocks, {
      left: 20,
      top: 48,
      right: 160,
      bottom: 48,
    })).toEqual([{ from: 10, to: 20 }]);
  });

  it('renders standalone image paragraphs using the image node range', async () => {
    const editor = await createEditor('![](./demo.png)');
    const view = editor.ctx.get(editorViewCtx);
    const displayRanges = getDisplayBlockRangesForDecorations(view.state.doc, [{ from: 0, to: 3 }]);

    expect(displayRanges).toEqual([{ from: 1, to: 2 }]);

    await editor.destroy();
  });

  it('does not decorate zero-width hardbreak nodes when selecting hard-break paragraph lines', async () => {
    const editor = await createEditor('alpha\\\nbravo');
    const view = editor.ctx.get(editorViewCtx);
    const decorations = createBlockSelectionDecorations(view.state.doc, [{ from: 1, to: 7 }]);

    expect(decorations.find().map((decoration: Decoration) => ({
      from: decoration.from,
      to: decoration.to,
      class: (decoration.type as any).attrs?.class,
    }))).toEqual([{
      from: 1,
      to: 6,
      class: 'editor-block-selected editor-block-selected-inline-line',
    }]);
    expect(view.state.doc.resolve(7).nodeBefore?.type.name).toBe('hardbreak');

    await editor.destroy();
  });

  it('marks hard-break paragraph lines as inline line selections', async () => {
    const editor = await createEditor('底线（-/=）方式（**不推荐**）：\\\n语法说明如下。');
    const view = editor.ctx.get(editorViewCtx);
    const hardBreakPos = (() => {
      let pos = -1;
      view.state.doc.descendants((node, nodePos) => {
        if (node.type.name === 'hardbreak' || node.type.name === 'hard_break') {
          pos = nodePos;
          return false;
        }
        return true;
      });
      return pos;
    })();
    const decorations = createBlockSelectionDecorations(view.state.doc, [{ from: 1, to: hardBreakPos + 1 }]);

    expect(decorations.find().map((decoration: Decoration) => (decoration.type as any).attrs?.class)).toEqual([
      'editor-block-selected editor-block-selected-inline-line',
    ]);

    await editor.destroy();
  });

  it('uses inline decoration for full text-node ranges inside hard-break paragraphs', async () => {
    const editor = await createEditor('alpha\\\nbravo');
    const view = editor.ctx.get(editorViewCtx);
    let lineFrom = -1;
    let lineTo = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.isText && node.text === 'bravo') {
        lineFrom = pos;
        lineTo = pos + node.nodeSize;
        return false;
      }
      return true;
    });
    const decorations = createBlockSelectionDecorations(view.state.doc, [{ from: lineFrom, to: lineTo }]);

    expect(decorations.find().map((decoration: Decoration) => ({
      from: decoration.from,
      to: decoration.to,
    }))).toEqual([{ from: lineFrom, to: lineTo }]);

    await editor.destroy();
  });

  // doc: bullet_list(14)[ list_item(12)[ paragraph(4), code_block(6) ] ]
  // Range A: { from:1, to:13 } — whole list item; pos=1 resolves to list_item
  // Range B: { from:6, to:12 } — code block alone; pos=6 resolves to code_block (not list_item)
  it('expands whole-item range (Range A) to full list_item decoration', () => {
    const listItemNode = { type: { name: 'list_item' }, nodeSize: 12 };
    const codeBlockNode = { type: { name: 'code_block' }, nodeSize: 6 };

    function makeDoc(resolveResult: { nodeAfter: typeof listItemNode | typeof codeBlockNode | null }) {
      return {
        content: { size: 14 },
        resolve(_pos: number) {
          return {
            nodeAfter: resolveResult.nodeAfter,
          };
        },
      } as any;
    }

    // Range A: from=1, to=13; nodeAfter at pos=1 is list_item → should expand to [1, 1+12=13]
    const docA = makeDoc({ nodeAfter: listItemNode });
    const rangesA = getDisplayBlockRangesForDecorations(docA, [{ from: 1, to: 13 }]);
    expect(rangesA).toEqual([{ from: 1, to: 13 }]);

    // Range B: from=6, to=12; nodeAfter at pos=6 is code_block (not list_item) → no expansion
    const docB = makeDoc({ nodeAfter: codeBlockNode });
    const rangesB = getDisplayBlockRangesForDecorations(docB, [{ from: 6, to: 12 }]);
    expect(rangesB).toEqual([{ from: 6, to: 12 }]);
  });

  it('marks complex list children as contained only when their list item is also selected', () => {
    const listItemNode = { type: { name: 'list_item' }, nodeSize: 12 };
    const codeBlockNode = { type: { name: 'code_block' }, nodeSize: 6 };

    const doc = {
      content: { size: 14 },
      resolve(_pos: number) {
        return {
          depth: 2,
          nodeAfter: codeBlockNode,
          node(depth: number) {
            return depth === 1 ? listItemNode : { type: { name: 'doc' }, nodeSize: 14 };
          },
          before(depth: number) {
            return depth === 1 ? 1 : 0;
          },
        };
      },
    } as any;

    expect(
      getBlockSelectionDecorationClass(doc, { from: 6, to: 12 }, [
        { from: 1, to: 13 },
        { from: 6, to: 12 },
      ]),
    ).toBe('editor-block-selected editor-block-selected-contained');

    expect(
      getBlockSelectionDecorationClass(doc, { from: 6, to: 12 }, [
        { from: 6, to: 12 },
      ]),
    ).toBe('editor-block-selected');
  });
});
