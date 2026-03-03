import { describe, expect, it } from 'vitest';
import {
  calculateTranslateBounds,
  clampCropToBounds,
  resolveCoverObjectFitMode,
} from './coverInteractionMath';

describe('coverInteractionMath', () => {
  it('resolves object fit mode with expected aspect rules', () => {
    expect(resolveCoverObjectFitMode(null, null)).toBe('horizontal-cover');
    expect(
      resolveCoverObjectFitMode(
        { width: 2000, height: 1000 },
        { width: 800, height: 400 }
      )
    ).toBe('horizontal-cover');
    expect(
      resolveCoverObjectFitMode(
        { width: 2000, height: 1000 },
        { width: 800, height: 600 }
      )
    ).toBe('vertical-cover');
  });

  it('calculates translate bounds from media/container/zoom', () => {
    const bounds = calculateTranslateBounds(
      { width: 1000, height: 500 },
      { width: 400, height: 200 },
      2
    );
    expect(bounds.maxTranslateX).toBe(200);
    expect(bounds.maxTranslateY).toBe(100);
  });

  it('returns zero bounds when size is missing', () => {
    expect(calculateTranslateBounds(null, { width: 100, height: 100 }, 2)).toEqual({
      maxTranslateX: 0,
      maxTranslateY: 0,
    });
  });

  it('clamps crop within bounds', () => {
    const clamped = clampCropToBounds(
      { x: 500, y: -300 },
      { maxTranslateX: 100, maxTranslateY: 50 }
    );
    expect(clamped).toEqual({ x: 100, y: -50 });
  });
});
