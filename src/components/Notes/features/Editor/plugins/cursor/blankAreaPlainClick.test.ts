import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import { describe, expect, it, vi } from 'vitest';
import {
  applyBlankAreaPlainClickSelection,
  resolveBlankAreaPlainClickAction,
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
