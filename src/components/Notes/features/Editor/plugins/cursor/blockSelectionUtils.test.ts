import { describe, expect, it } from 'vitest';
import {
  createDragSelectionRect,
  getBlockRangesKey,
  isRectIntersecting,
  normalizeBlockRanges,
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
