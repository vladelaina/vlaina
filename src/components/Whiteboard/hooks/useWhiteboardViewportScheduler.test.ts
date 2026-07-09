import { describe, expect, it } from 'vitest';
import { applyWhiteboardViewportUpdates } from './useWhiteboardViewportScheduler';

describe('applyWhiteboardViewportUpdates', () => {
  it('applies queued viewport updates in order', () => {
    expect(applyWhiteboardViewportUpdates(
      { x: 0, y: 0, zoom: 1 },
      [
        (current) => ({ ...current, x: current.x - 10 }),
        (current) => ({ ...current, y: current.y - 20 }),
        { x: 5, y: 6, zoom: 2 },
      ],
    )).toEqual({ x: 5, y: 6, zoom: 2 });
  });
});
