import { describe, expect, it, vi } from 'vitest';

vi.mock('@milkdown/kit/prose/state', () => ({
  Plugin: class {
    constructor(public spec: unknown) {}
  },
  AllSelection: {
    create: vi.fn(() => 'all-selection'),
  },
}));

import { handleEditorSelectAll } from './selectAllPlugin';

describe('handleEditorSelectAll', () => {
  it('dispatches an editor-wide selection for Mod-a', () => {
    const transaction = {};
    const setSelection = vi.fn(() => transaction);
    const view = {
      dom: document.createElement('div'),
      state: {
        doc: {
          content: {
            size: 10,
          },
        },
        selection: {
          from: 1,
          to: 1,
          empty: true,
          constructor: { name: 'TextSelection' },
        },
        tr: {
          setSelection,
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    } as any;
    const event = {
      key: 'a',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as any;

    expect(handleEditorSelectAll(view, event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(setSelection).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(transaction);
    expect(view.focus).toHaveBeenCalledTimes(1);
  });

  it('ignores non-select-all shortcuts', () => {
    const view = {
      dom: document.createElement('div'),
      state: {
        selection: {
          from: 1,
          to: 1,
          empty: true,
          constructor: { name: 'TextSelection' },
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    } as any;
    const event = {
      key: 'b',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as any;

    expect(handleEditorSelectAll(view, event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
