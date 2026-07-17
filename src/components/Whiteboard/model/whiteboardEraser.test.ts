import { describe, expect, it } from 'vitest';
import { getWhiteboardEraserTargets } from './whiteboardEraser';

describe('whiteboard object eraser', () => {
  it('hits images and strokes across fast pointer movement', () => {
    const targets = getWhiteboardEraserTargets(
      [{ height: 20, id: 'image', text: '', type: 'image', width: 20, x: 490, y: -10 }],
      [{ color: '#111111', id: 'stroke', points: [{ pressure: 0.5, x: 500, y: -20 }, { pressure: 0.5, x: 500, y: 20 }], size: 1, tool: 'pen' }],
      [{ point: { x: 0, y: 0 }, size: 1 }, { point: { x: 1000, y: 0 }, size: 1 }],
    );
    expect(targets.elementIds).toEqual(['image']);
    expect(targets.strokeIds).toEqual(['stroke']);
  });

  it('leaves distant content untouched', () => {
    const targets = getWhiteboardEraserTargets(
      [{ height: 40, id: 'image', text: '', type: 'image', width: 40, x: 200, y: 200 }],
      [],
      [{ point: { x: 0, y: 0 }, size: 1 }],
    );
    expect(targets).toMatchObject({ elementIds: [], strokeIds: [] });
  });
});
