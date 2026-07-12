import { describe, expect, it } from 'vitest';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { createWhiteboardElement } from './whiteboardModel';

describe('createWhiteboardElement', () => {
  it('centers notes at the requested board point', () => {
    const element = createWhiteboardElement('wb-element-1', 'note', { x: 300, y: 200 });

    expect(element).toEqual({
      id: 'wb-element-1',
      type: 'note',
      x: 300 - themeWhiteboardTokens.noteWidthPx / 2,
      y: 200 - themeWhiteboardTokens.noteHeightPx / 2,
      width: themeWhiteboardTokens.noteWidthPx,
      height: themeWhiteboardTokens.noteHeightPx,
      text: '',
    });
  });

  it('uses the shared shape dimensions for rectangles and ellipses', () => {
    for (const type of ['rect', 'ellipse'] as const) {
      const element = createWhiteboardElement(`wb-element-${type}`, type, { x: 0, y: 0 });
      expect(element.width).toBe(themeWhiteboardTokens.shapeWidthPx);
      expect(element.height).toBe(themeWhiteboardTokens.shapeHeightPx);
    }
  });
});
