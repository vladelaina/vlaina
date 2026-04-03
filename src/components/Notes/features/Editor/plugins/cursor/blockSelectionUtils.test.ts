import { describe, expect, it } from 'vitest';
import {
  convertBlockRectsToDocumentSpace,
  convertViewportDragRectToDocumentRect,
  createDragSelectionRect,
  getBlockRangesKey,
  isRectIntersecting,
  normalizeBlockRanges,
  resolveDisplayedDragViewportRect,
  resolveIntersectedBlockRanges,
  type BlockRect,
} from './blockSelectionUtils';

describe('blockSelectionUtils', () => {
  it('normalizes drag rectangle in any direction', () => {
    expect(createDragSelectionRect(100, 80, 20, 10)).toEqual({
      left: 20,
      top: 10,
      right: 100,
      bottom: 80,
    });
  });

  it('treats touching edges as intersection', () => {
    expect(
      isRectIntersecting(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 10, top: 5, right: 20, bottom: 15 },
      ),
    ).toBe(true);
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
});
