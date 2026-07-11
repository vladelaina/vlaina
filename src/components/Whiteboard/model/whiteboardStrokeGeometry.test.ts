import { describe, expect, it } from 'vitest';
import type { WhiteboardStroke } from './whiteboardModel';
import { appendStrokePointsInPlace, eraseStrokeAtPoint, eraseStrokesAtPoints, getStrokePointMinDistance, getStrokeRenderGeometry } from './whiteboardStrokeGeometry';

describe('whiteboard stroke geometry erasing', () => {
  it('applies batched eraser points in order', () => {
    const stroke: WhiteboardStroke = {
      color: '#111111',
      id: 'stroke',
      points: [
        { pressure: 0.5, x: 0, y: 0 },
        { pressure: 0.5, x: 40, y: 0 },
        { pressure: 0.5, x: 80, y: 0 },
        { pressure: 0.5, x: 120, y: 0 },
      ],
      size: 1,
      tool: 'pen',
    };
    const points = [
      { point: { x: 40, y: 0 }, size: 1 },
      { point: { x: 80, y: 0 }, size: 1 },
    ];

    const sequential = points.reduce(
      (current, eraserPoint) => current.flatMap((item) => eraseStrokeAtPoint(item, eraserPoint.point, eraserPoint.size)),
      [stroke],
    );

    expect(eraseStrokesAtPoints([stroke], points)).toEqual(sequential);
  });

  it('keeps strokes outside the batched eraser bounds unchanged', () => {
    const nearStroke: WhiteboardStroke = {
      color: '#111111',
      id: 'near',
      points: [
        { pressure: 0.5, x: 0, y: 0 },
        { pressure: 0.5, x: 40, y: 0 },
      ],
      size: 1,
      tool: 'pen',
    };
    const farStroke: WhiteboardStroke = {
      color: '#222222',
      id: 'far',
      points: [
        { pressure: 0.5, x: 1000, y: 1000 },
        { pressure: 0.5, x: 1040, y: 1000 },
      ],
      size: 1,
      tool: 'pen',
    };

    const result = eraseStrokesAtPoints([nearStroke, farStroke], [
      { point: { x: 0, y: 0 }, size: 1 },
    ]);

    expect(result).toContain(farStroke);
    expect(result.some((stroke) => stroke.id === nearStroke.id)).toBe(false);
  });
});

describe('whiteboard stroke point sampling', () => {
  it('keeps stroke point spacing stable in screen pixels across zoom levels', () => {
    const points = [{ pressure: 0.5, x: 0, y: 0 }];

    appendStrokePointsInPlace(points, [
      { pressure: 0.5, x: 2, y: 0 },
      { pressure: 0.5, x: 12, y: 0 },
    ], getStrokePointMinDistance(0.2));

    expect(points).toEqual([
      { pressure: 0.5, x: 0, y: 0 },
      { pressure: 0.5, x: 12, y: 0 },
    ]);
  });
});

describe('whiteboard stroke render geometry', () => {
  it('updates cached render geometry when draft points are appended in place', () => {
    const stroke: WhiteboardStroke = {
      color: '#111111',
      id: 'stroke',
      points: [
        { pressure: 0.5, x: 0, y: 0 },
        { pressure: 0.5, x: 40, y: 0 },
      ],
      size: 1,
      tool: 'crayon',
    };

    const initial = getStrokeRenderGeometry(stroke);
    appendStrokePointsInPlace(stroke.points, [
      { pressure: 0.5, x: 80, y: 0 },
    ]);
    const updated = getStrokeRenderGeometry(stroke);

    expect(updated).not.toBe(initial);
    expect(updated.centerPath).toContain('80');
    expect(updated.pressurePath).toContain('80');
  });
});
