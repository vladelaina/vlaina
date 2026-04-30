import { afterEach, describe, expect, it } from 'vitest';
import { Editor, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import {
  clampViewportRectTop,
  convertBlockRectsToDocumentSpace,
  convertViewportDragRectToDocumentRect,
  createDragSelectionRect,
  getDisplayBlockRangesForDecorations,
  getBlockRangesKey,
  isRectIntersecting,
  normalizeBlockRanges,
  pruneContainedBlockRanges,
  resolveDisplayedDragViewportRect,
  resolveIntersectedBlockRanges,
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
});
