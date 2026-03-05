import { describe, expect, it } from 'vitest';
import {
  calculateCropPercentage,
  calculateCropPixels,
  getBaseDimensions,
} from './coverUtils';

describe('coverUtils', () => {
  it('returns zero crop pixels for centered position', () => {
    const crop = calculateCropPixels(
      { x: 50, y: 50 },
      { width: 1600, height: 900 },
      { width: 320, height: 180 },
      1.3
    );

    expect(crop).toEqual({ x: 0, y: 0 });
  });

  it('keeps sub-pixel precision for crop pixels', () => {
    const crop = calculateCropPixels(
      { x: 47.3, y: 52.8 },
      { width: 1200, height: 800 },
      { width: 333, height: 211 },
      1.17
    );

    expect(Number.isInteger(crop.x)).toBe(false);
    expect(Number.isInteger(crop.y)).toBe(false);
  });

  it('preserves position in percentage<->pixel round trip', () => {
    const position = { x: 37.42, y: 68.19 };
    const media = { width: 1346, height: 1080 };
    const container = { width: 511, height: 321 };
    const zoom = 1.093;

    const crop = calculateCropPixels(position, media, container, zoom);
    const next = calculateCropPercentage(crop, media, container, zoom);

    expect(next.x).toBeCloseTo(position.x, 6);
    expect(next.y).toBeCloseTo(position.y, 6);
  });

  it('clamps percentage output to 0..100', () => {
    const media = { width: 1400, height: 900 };
    const container = { width: 360, height: 220 };
    const zoom = 1.4;
    const base = getBaseDimensions(media, container);
    const maxTranslateX = (base.width * zoom - container.width) / 2;
    const maxTranslateY = (base.height * zoom - container.height) / 2;

    const clamped = calculateCropPercentage(
      { x: maxTranslateX * 10, y: -maxTranslateY * 10 },
      media,
      container,
      zoom
    );

    expect(clamped.x).toBeGreaterThanOrEqual(0);
    expect(clamped.x).toBeLessThanOrEqual(100);
    expect(clamped.y).toBeGreaterThanOrEqual(0);
    expect(clamped.y).toBeLessThanOrEqual(100);
  });
});
