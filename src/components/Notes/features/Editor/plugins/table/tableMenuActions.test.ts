import { describe, expect, it } from 'vitest';

import { isTableMenuCellPosValid } from './tableMenuActions';

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
});
