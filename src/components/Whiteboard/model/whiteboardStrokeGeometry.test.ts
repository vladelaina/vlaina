import { describe, expect, it } from 'vitest';
import type { WhiteboardStroke } from './whiteboardModel';
import { eraseStrokeAtPoint, eraseStrokesAtPoints } from './whiteboardStrokeGeometry';

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
});
