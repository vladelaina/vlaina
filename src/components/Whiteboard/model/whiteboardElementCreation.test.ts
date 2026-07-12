import { describe, expect, it } from 'vitest';
import { themeWhiteboardTokens } from '@/styles/themeTokens';
import { createWhiteboardElementFromDrag } from './whiteboardElementCreation';

describe('createWhiteboardElementFromDrag', () => {
  it('uses the default centered size for a click-sized gesture', () => {
    const element = createWhiteboardElementFromDrag('element-1', 'note', { x: 200, y: 100 }, { x: 203, y: 102 });

    expect(element).toMatchObject({
      x: 200 - themeWhiteboardTokens.noteWidthPx / 2,
      y: 100 - themeWhiteboardTokens.noteHeightPx / 2,
      width: themeWhiteboardTokens.noteWidthPx,
      height: themeWhiteboardTokens.noteHeightPx,
    });
  });

  it('creates a dragged shape in either pointer direction', () => {
    const element = createWhiteboardElementFromDrag('element-1', 'rect', { x: 300, y: 240 }, { x: 120, y: 100 });

    expect(element).toMatchObject({ x: 120, y: 100, width: 180, height: 140 });
  });

  it('enforces the shared minimum element size', () => {
    const element = createWhiteboardElementFromDrag('element-1', 'ellipse', { x: 10, y: 10 }, { x: 30, y: 50 });

    expect(element.width).toBe(themeWhiteboardTokens.minElementWidthPx);
    expect(element.height).toBe(themeWhiteboardTokens.minElementHeightPx);
  });
});
