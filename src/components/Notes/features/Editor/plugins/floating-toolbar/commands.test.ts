import { describe, expect, it, vi } from 'vitest';
import { copySelectionToClipboard, setTextAlignment } from './commands';

describe('floating toolbar commands', () => {
  it('updates paragraph alignment for the current block selection', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 5,
          to: 9,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 4),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'doc' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
      align: 'center',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('copies normalized selected text to clipboard', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

    const view: any = {
      state: {
        selection: {
          from: 1,
          to: 8,
        },
        doc: {
          slice: vi.fn(() => ({
            content: {
              forEach: (callback: (node: any) => void) => {
                callback({
                  isText: true,
                  text: 'Hello',
                  marks: [],
                  type: { name: 'text' },
                });
              },
            },
          })),
        },
      },
      focus: vi.fn(),
    };

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(clipboardWrite).toHaveBeenCalledWith('Hello');
    expect(view.focus).toHaveBeenCalled();
  });

  it('returns false when there is no selection to copy', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWrite },
      configurable: true,
    });

    const view: any = {
      state: {
        selection: {
          from: 3,
          to: 3,
        },
      },
      focus: vi.fn(),
    };

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(false);
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(view.focus).not.toHaveBeenCalled();
  });
});
