import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import { describe, expect, it, vi } from 'vitest';
import {
  applyBlankAreaPlainClickSelection,
  resolveBlankAreaPlainClickAction,
  resolveInsideBlockTrailingPlainClickAction,
} from './blankAreaPlainClick';

describe('resolveBlankAreaPlainClickAction', () => {
  const blockRects = [
    { from: 0, to: 5, left: 100, right: 420, top: 40, bottom: 64 },
    { from: 6, to: 14, left: 120, right: 460, top: 84, bottom: 112 },
    { from: 15, to: 21, left: 100, right: 420, top: 132, bottom: 156 },
  ];

  it('focuses the nearest block start when clicking in the left blank area', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects,
        clientX: 36,
        clientY: 92,
      })
    ).toEqual({
      targetPos: 7,
      bias: 1,
      blockFrom: 6,
    });
  });

  it('focuses the nearest block end when clicking in the right blank area', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects,
        clientX: 720,
        clientY: 92,
      })
    ).toEqual({
      targetPos: 13,
      bias: -1,
      blockFrom: 6,
    });
  });

  it('uses content bounds instead of the full block hit area for right-side blank clicks', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects: [
          {
            from: 0,
            to: 8,
            left: 20,
            right: 620,
            contentLeft: 100,
            contentRight: 180,
            top: 40,
            bottom: 64,
          },
        ],
        clientX: 260,
        clientY: 52,
      })
    ).toEqual({
      targetPos: 7,
      bias: -1,
      blockFrom: 0,
    });
  });

  it('uses the clicked visual line bounds for right-side blank clicks in wrapped blocks', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects: [
          {
            from: 1,
            to: 38,
            left: 20,
            right: 900,
            contentLeft: 398,
            contentRight: 840,
            contentLineRects: [
              { left: 398, top: 436, right: 840, bottom: 456 },
              { left: 398, top: 461, right: 517, bottom: 481 },
            ],
            top: 434,
            bottom: 484,
          },
        ],
        clientX: 613,
        clientY: 483,
      })
    ).toEqual({
      targetPos: 37,
      bias: -1,
      blockFrom: 1,
    });
  });

  it('chooses the nearest visual line when line slack overlaps', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects: [
          {
            from: 1,
            to: 38,
            left: 20,
            right: 900,
            contentLeft: 398,
            contentRight: 840,
            contentLineRects: [
              { left: 398, top: 436, right: 840, bottom: 456 },
              { left: 398, top: 459, right: 517, bottom: 479 },
            ],
            top: 434,
            bottom: 482,
          },
        ],
        clientX: 613,
        clientY: 459,
      })
    ).toEqual({
      targetPos: 37,
      bias: -1,
      blockFrom: 1,
    });
  });

  it('prefers the later block when a list rect overlaps the following blank paragraph', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects: [
          {
            from: 1,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 128,
          },
          {
            from: 13,
            to: 15,
            left: 40,
            right: 620,
            contentLeft: 40,
            contentRight: 620,
            top: 104,
            bottom: 128,
          },
        ],
        clientX: 44,
        clientY: 116,
      })
    ).toEqual({
      targetPos: 14,
      bias: 1,
      blockFrom: 13,
    });
  });

  it('falls back to the first block when clicking above all blocks', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects,
        clientX: 24,
        clientY: 8,
      })
    ).toEqual({
      targetPos: 1,
      bias: 1,
      blockFrom: 0,
    });
  });

  it('returns null when there are no selectable blocks', () => {
    expect(
      resolveBlankAreaPlainClickAction({
        blockRects: [],
        clientX: 0,
        clientY: 0,
      })
    ).toBeNull();
  });
});

describe('resolveInsideBlockTrailingPlainClickAction', () => {
  it('focuses the block end when clicking inside a wide list item after its text content', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 320,
        clientY: 92,
      })
    ).toEqual({
      targetPos: 11,
      bias: -1,
      blockFrom: 4,
    });
  });

  it('focuses a paragraph end when clicking trailing blank space after its inline content', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 0,
            to: 8,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
            allowInsideTrailingClick: true,
          },
          {
            from: 8,
            to: 16,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 220,
            top: 116,
            bottom: 140,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 320,
        clientY: 92,
      })
    ).toEqual({
      targetPos: 7,
      bias: -1,
      blockFrom: 0,
    });
  });

  it('leaves normal text clicks to the editor native handler', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 160,
        clientY: 92,
      })
    ).toBeNull();
  });

  it('leaves clicks near the text end to the editor native handler', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 196,
        clientY: 92,
      })
    ).toBeNull();
  });

  it('focuses the previous list item end when clicking the right-side gap before the next item', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
            allowInsideTrailingClick: true,
          },
          {
            from: 12,
            to: 20,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 220,
            top: 116,
            bottom: 140,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 320,
        clientY: 110,
      })
    ).toEqual({
      targetPos: 11,
      bias: -1,
      blockFrom: 4,
    });
  });

  it('uses the clicked visual line end for wrapped list item trailing space', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 24,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 360,
            contentLineRects: [
              { left: 96, top: 80, right: 180, bottom: 100 },
              { left: 96, top: 104, right: 360, bottom: 124 },
            ],
            top: 80,
            bottom: 124,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 208,
        clientY: 90,
      })
    ).toEqual({
      targetPos: 23,
      bias: -1,
      blockFrom: 4,
    });
  });

  it('leaves left-side list item gaps to the editor native handler', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
            allowInsideTrailingClick: true,
          },
          {
            from: 12,
            to: 20,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 220,
            top: 116,
            bottom: 140,
            allowInsideTrailingClick: true,
          },
        ],
        clientX: 120,
        clientY: 110,
      })
    ).toBeNull();
  });

  it('does not override native clicks for non-list blocks', () => {
    expect(
      resolveInsideBlockTrailingPlainClickAction({
        blockRects: [
          {
            from: 4,
            to: 12,
            left: 40,
            right: 620,
            contentLeft: 96,
            contentRight: 180,
            top: 80,
            bottom: 104,
          },
        ],
        clientX: 320,
        clientY: 92,
      })
    ).toBeNull();
  });
});

describe('applyBlankAreaPlainClickSelection', () => {
  it('clamps the requested position into the current document before resolving selection', () => {
    const resolved = { pos: 10 };
    const selection = { from: 10, to: 10, empty: true };
    const setSelection = vi.fn().mockImplementation(() => tr);
    const resolve = vi.fn().mockReturnValue(resolved);
    const nearSpy = vi.spyOn(Selection, 'near').mockReturnValue(selection as any);
    const tr = {
      doc: {
        content: { size: 10 },
        nodeAt: vi.fn().mockReturnValue({ type: { name: 'paragraph' } }),
        resolve,
      },
      setSelection,
    } as any;

    applyBlankAreaPlainClickSelection(tr, {
      targetPos: 99,
      bias: -1,
      blockFrom: 0,
    });

    expect(resolve).toHaveBeenCalledWith(10);
    expect(nearSpy).toHaveBeenCalledWith(resolved, -1);
    expect(setSelection).toHaveBeenCalledWith(selection);
    nearSpy.mockRestore();
  });

  it('moves atomic diagram side clicks to nearby text instead of selecting the diagram node', () => {
    const textSelection = Object.create(TextSelection.prototype);
    const setSelection = vi.fn().mockImplementation(() => tr);
    const blockStart = { pos: 5 };
    const blockEnd = { pos: 6 };
    const findFromSpy = vi.spyOn(Selection, 'findFrom')
      .mockReturnValueOnce(textSelection)
      .mockReturnValueOnce(null);
    const tr = {
      doc: {
        content: { size: 10 },
        nodeAt: vi.fn().mockReturnValue({ type: { name: 'mermaid' }, nodeSize: 1 }),
        resolve: vi.fn()
          .mockReturnValueOnce(blockStart)
          .mockReturnValueOnce(blockEnd),
      },
      setSelection,
    } as any;

    applyBlankAreaPlainClickSelection(tr, {
      targetPos: 6,
      bias: 1,
      blockFrom: 5,
    });

    expect(findFromSpy).toHaveBeenCalledWith(blockStart, -1, true);
    expect(setSelection).toHaveBeenCalledWith(textSelection);
    findFromSpy.mockRestore();
  });

  it('does not create a node selection for atomic diagram side clicks when no text cursor is nearby', () => {
    const setSelection = vi.fn().mockImplementation(() => tr);
    const findFromSpy = vi.spyOn(Selection, 'findFrom').mockReturnValue(null);
    const tr = {
      doc: {
        content: { size: 10 },
        nodeAt: vi.fn().mockReturnValue({ type: { name: 'math_block' }, nodeSize: 1 }),
        resolve: vi.fn().mockReturnValue({}),
      },
      setSelection,
    } as any;

    expect(applyBlankAreaPlainClickSelection(tr, {
      targetPos: 6,
      bias: 1,
      blockFrom: 5,
    })).toBe(tr);

    expect(findFromSpy).toHaveBeenCalledTimes(2);
    expect(setSelection).not.toHaveBeenCalled();
    findFromSpy.mockRestore();
  });
});
