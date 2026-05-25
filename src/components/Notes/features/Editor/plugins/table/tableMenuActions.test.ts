import { describe, expect, it, vi } from 'vitest';

const tableMocks = vi.hoisted(() => ({
  addRowBefore: vi.fn(() => true),
  addRowAfter: vi.fn(() => true),
  addColumnBefore: vi.fn(() => true),
  addColumnAfter: vi.fn(() => true),
  deleteRow: vi.fn(() => true),
  deleteColumn: vi.fn(() => true),
  deleteTable: vi.fn(() => true),
}));

vi.mock('@milkdown/kit/prose/tables', () => tableMocks);
vi.mock('@milkdown/kit/prose/state', () => ({
  Selection: {
    near: vi.fn(() => ({ type: 'near-selection' })),
  },
}));

import { isTableMenuCellPosValid, runTableMenuAction } from './tableMenuActions';

describe('table menu actions', () => {
  it('accepts stored positions that still point at a table cell', () => {
    const view = {
      state: {
        doc: {
          nodeAt: (pos: number) =>
            pos === 12
              ? {
                  type: {
                    name: 'table_cell',
                  },
                }
              : null,
        },
      },
    };

    expect(isTableMenuCellPosValid(view as never, 12)).toBe(true);
  });

  it('rejects stale positions that no longer point at a table cell', () => {
    const view = {
      state: {
        doc: {
          nodeAt: () => ({
            type: {
              name: 'paragraph',
            },
          }),
        },
      },
    };

    expect(isTableMenuCellPosValid(view as never, 12)).toBe(false);
  });

  it('marks table menu mutations as user input before running the command', () => {
    const dom = new EventTarget();
    const listener = vi.fn();
    dom.addEventListener('vlaina:block-user-input', listener);
    const tr = {
      setSelection: vi.fn(() => tr),
    };
    const view = {
      dom,
      state: {
        doc: {
          content: { size: 80 },
          nodeAt: (pos: number) =>
            pos === 12
              ? {
                  type: {
                    name: 'table_cell',
                  },
                }
              : null,
          resolve: vi.fn(() => ({ pos: 13 })),
        },
        tr,
      },
      dispatch: vi.fn(),
    };

    expect(runTableMenuAction('insert-row-below', view as never, 12)).toBe(true);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(tableMocks.addRowAfter).toHaveBeenCalledWith(view.state, view.dispatch);
  });
});
