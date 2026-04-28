import { describe, expect, it } from 'vitest';
import type { HandleBlockTarget } from './blockControlsInteractionTypes';
import { setControlsPosition } from './blockControlsGeometry';

function createTarget(left: number, top: number, height: number, isListItem = true): HandleBlockTarget {
  return {
    pos: 0,
    isListItem,
    rect: {
      x: left,
      y: top,
      left,
      top,
      right: left + 100,
      bottom: top + height,
      width: 100,
      height,
      toJSON: () => ({}),
    } as DOMRect,
  };
}

describe('setControlsPosition', () => {
  it('uses the current target for vertical placement and the anchor target for horizontal placement', () => {
    const controls = document.createElement('div');
    const anchor = createTarget(80, 0, 20);
    const nestedTarget = createTarget(128, 40, 20);

    setControlsPosition(controls, nestedTarget, 44, anchor);

    expect(controls.style.left).toBe('12px');
    expect(controls.style.top).toBe('50px');
  });
});
