import { describe, expect, it } from 'vitest';
import { getWhiteboardConnectorEndpoints, getWhiteboardElementBoundaryPoint } from './whiteboardConnectorGeometry';
import type { WhiteboardElement } from './whiteboardModel';

const rectangle: WhiteboardElement = {
  id: 'rect-1', type: 'rect', x: 0, y: 0, width: 100, height: 80, text: '',
};

describe('getWhiteboardConnectorEndpoints', () => {
  it('stops horizontal connectors at rectangle edges', () => {
    const endpoints = getWhiteboardConnectorEndpoints(rectangle, {
      ...rectangle, id: 'rect-2', x: 300,
    });

    expect(endpoints).toEqual({ from: { x: 100, y: 40 }, to: { x: 300, y: 40 } });
  });

  it('intersects ellipse boundaries instead of their bounding boxes', () => {
    const endpoints = getWhiteboardConnectorEndpoints(
      { ...rectangle, type: 'ellipse' },
      { ...rectangle, id: 'rect-2', type: 'ellipse', x: 200, y: 160 },
    );

    expect(endpoints.from.x).toBeGreaterThan(80);
    expect(endpoints.from.y).toBeGreaterThan(60);
    expect(endpoints.to.x).toBeLessThan(220);
    expect(endpoints.to.y).toBeLessThan(180);
  });

  it('anchors a live connector preview on the source boundary', () => {
    expect(getWhiteboardElementBoundaryPoint(rectangle, { x: 200, y: 40 })).toEqual({ x: 100, y: 40 });
  });
});
