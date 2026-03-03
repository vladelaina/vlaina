import { describe, expect, it } from 'vitest';
import {
  buildResizeSnapshot,
  calculateEffectiveResizeHeight,
  calculateFinalCropFromResize,
  calculateVerticalShift,
} from './coverResizeMath';

describe('coverResizeMath', () => {
  it('builds snapshot from media/container/zoom/crop', () => {
    const snapshot = buildResizeSnapshot(
      { width: 1200, height: 600 },
      { width: 400, height: 200 },
      1,
      { x: 10, y: -5 }
    );

    expect(snapshot.scaledWidth).toBeCloseTo(400, 6);
    expect(snapshot.scaledHeight).toBeCloseTo(200, 6);
    expect(snapshot.absoluteLeft).toBeCloseTo(10, 6);
    expect(snapshot.absoluteTop).toBeCloseTo(-5, 6);
  });

  it('clamps effective height by min/max and mechanical limit', () => {
    expect(calculateEffectiveResizeHeight(200, -200, 1000)).toBe(120);
    expect(calculateEffectiveResizeHeight(200, 200, 250)).toBe(250);
  });

  it('calculates vertical shift only when height exceeds visual range', () => {
    expect(calculateVerticalShift(180, 200, 20)).toBe(0);
    expect(calculateVerticalShift(230, 200, 20)).toBe(20);
    expect(calculateVerticalShift(210, 200, 20)).toBe(10);
  });

  it('computes finite final crop', () => {
    const snapshot = buildResizeSnapshot(
      { width: 1200, height: 600 },
      { width: 400, height: 200 },
      1.5,
      { x: 0, y: 0 }
    );
    const crop = calculateFinalCropFromResize(snapshot, 220, 10);

    expect(Number.isFinite(crop.x)).toBe(true);
    expect(Number.isFinite(crop.y)).toBe(true);
  });
});
