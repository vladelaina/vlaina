import { describe, expect, it } from 'vitest';
import {
  createBlockMovePlan,
  mapRangesToTopLevelBlocks,
  pickPointerBlock,
  type PointerBlockTarget,
} from './blockControlsUtils';

describe('pickPointerBlock', () => {
  const blocks: PointerBlockTarget[] = [
    { rect: { top: 0, bottom: 20, height: 20 } },
    { rect: { top: 30, bottom: 50, height: 20 } },
  ];

  it('returns first block when pointer is unavailable', () => {
    expect(pickPointerBlock(blocks, null)).toBe(blocks[0]);
  });

  it('returns directly hit block', () => {
    expect(pickPointerBlock(blocks, 35)).toBe(blocks[1]);
  });

  it('returns nearest block by center when no direct hit', () => {
    expect(pickPointerBlock(blocks, 26)).toBe(blocks[1]);
  });
});

describe('createBlockMovePlan', () => {
  it('returns null when insert position is inside selected range', () => {
    expect(createBlockMovePlan([{ from: 10, to: 20 }], 15)).toBeNull();
  });

  it('returns null when target stays at original head position', () => {
    expect(createBlockMovePlan([{ from: 10, to: 20 }], 20)).toBeNull();
  });

  it('adjusts target position after deleting ranges before insert point', () => {
    const movePlan = createBlockMovePlan(
      [
        { from: 0, to: 5 },
        { from: 10, to: 14 },
      ],
      30,
    );
    expect(movePlan).toEqual({
      selectedRanges: [
        { from: 0, to: 5 },
        { from: 10, to: 14 },
      ],
      targetPos: 21,
    });
  });
});

describe('mapRangesToTopLevelBlocks', () => {
  it('maps ranges and removes duplicates', () => {
    const mapped = mapRangesToTopLevelBlocks(
      [
        { from: 12, to: 14 },
        { from: 8, to: 10 },
        { from: 13, to: 15 },
      ],
      (pos) => {
        if (pos >= 12) return { from: 10, to: 20 };
        if (pos >= 8) return { from: 0, to: 5 };
        return null;
      },
    );

    expect(mapped).toEqual([
      { from: 0, to: 5 },
      { from: 10, to: 20 },
    ]);
  });
});
