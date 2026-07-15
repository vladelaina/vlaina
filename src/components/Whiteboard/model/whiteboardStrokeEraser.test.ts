import { describe, expect, it } from 'vitest';
import { eraseWhiteboardStrokes } from './whiteboardStrokeEraser';

describe('whiteboard stroke eraser', () => {
  it('removes only the swept section and preserves both sides', () => {
    const [stroke] = eraseWhiteboardStrokes([{
      color: '#111111',
      id: 'stroke',
      points: [{ pressure: 0.5, x: 0, y: 0 }, { pressure: 0.5, x: 100, y: 0 }],
      size: 1,
      tool: 'pen',
    }], [
      { point: { x: 50, y: -20 }, size: 1 },
      { point: { x: 50, y: 20 }, size: 1 },
    ]);

    expect(stroke.points[0].x).toBe(0);
    expect(stroke.points.at(-1)?.x).toBe(100);
    expect(stroke.points.some((point) => point.breakBefore)).toBe(true);
    expect(stroke.points.some((point) => point.x === 50)).toBe(false);
  });

  it('returns the original array when the sweep misses', () => {
    const strokes = [{
      color: '#111111',
      id: 'stroke',
      points: [{ pressure: 0.5, x: 0, y: 0 }, { pressure: 0.5, x: 100, y: 0 }],
      size: 1,
      tool: 'pen' as const,
    }];

    expect(eraseWhiteboardStrokes(strokes, [{ point: { x: 50, y: 100 }, size: 1 }])).toBe(strokes);
  });
});
