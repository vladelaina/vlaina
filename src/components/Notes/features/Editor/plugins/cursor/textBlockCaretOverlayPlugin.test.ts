import { describe, expect, it, vi } from 'vitest';
import { isTagTokenBoundaryAtTextblock } from './textBlockCaretOverlayPlugin';

function createParent(text: string) {
  return {
    content: { size: text.length },
    textBetween: vi.fn((from: number, to: number) => text.slice(from, to)),
    get textContent() {
      throw new Error('aggregate parent textContent should not be read');
    },
  };
}

describe('textBlockCaretOverlayPlugin', () => {
  it('detects a tag token boundary without reading aggregate text', () => {
    const parent = createParent('hello #tag');

    expect(isTagTokenBoundaryAtTextblock(parent, 10)).toBe(true);
    expect(parent.textBetween).toHaveBeenCalledWith(0, 10, '\0', '\0');
  });

  it('does not treat a tag token as complete when another token character follows', () => {
    const parent = createParent('hello #tagx');

    expect(isTagTokenBoundaryAtTextblock(parent, 10)).toBe(false);
    expect(parent.textBetween).toHaveBeenCalledWith(10, 11, '\0', '\0');
  });

  it('limits tag boundary lookbehind text reads', () => {
    const parent = createParent(`${'x'.repeat(512)} #tag`);

    expect(isTagTokenBoundaryAtTextblock(parent, 517)).toBe(true);
    expect(parent.textBetween).toHaveBeenCalledWith(261, 517, '\0', '\0');
  });
});
