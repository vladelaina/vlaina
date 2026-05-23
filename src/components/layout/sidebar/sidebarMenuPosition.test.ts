import { describe, expect, it } from 'vitest';
import {
  getSidebarContextMenuPosition,
  getSidebarMenuPositionFromTriggerRect,
} from './sidebarMenuPosition';

function makeRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    x: 12,
    y: 20,
    top: 20,
    right: 240,
    bottom: 48,
    left: 12,
    width: 228,
    height: 28,
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('sidebarMenuPosition', () => {
  it('places trigger menus to the right of the row', () => {
    expect(getSidebarMenuPositionFromTriggerRect(makeRect())).toEqual({
      top: 20,
      left: 244,
    });
  });

  it('places context menus at the pointer when a pointer x-coordinate is provided', () => {
    expect(getSidebarContextMenuPosition(makeRect(), 72, 36)).toEqual({
      top: 72,
      left: 36,
    });
  });

  it('keeps the legacy row-overlap position when opened without a pointer x-coordinate', () => {
    expect(getSidebarContextMenuPosition(makeRect(), 72)).toEqual({
      top: 72,
      left: 184,
    });
  });
});
