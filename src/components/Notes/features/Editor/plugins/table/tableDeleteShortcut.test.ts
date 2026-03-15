import { describe, expect, it } from 'vitest';
import {
  findLeadingTableDeleteRange,
  shouldDeleteTableOnLeadingBackspace,
} from './tableDeleteShortcut';

function createState({
  empty = true,
  parentOffset = 0,
  parentIsTextblock = true,
  nodes = ['doc', 'table', 'table_header_row', 'table_header', 'paragraph'],
  indexes = { 1: 0, 2: 0 },
}: {
  empty?: boolean;
  parentOffset?: number;
  parentIsTextblock?: boolean;
  nodes?: string[];
  indexes?: Record<number, number>;
} = {}) {
  return {
    selection: {
      empty,
      $from: {
        depth: nodes.length - 1,
        parentOffset,
        parent: {
          isTextblock: parentIsTextblock,
        },
        before: (depth?: number) => {
          if (depth === 1) return 5;
          return 0;
        },
        after: (depth?: number) => {
          if (depth === 1) return 17;
          return 0;
        },
        node: (depth: number) => ({
          type: {
            name: nodes[depth],
          },
        }),
        index: (depth: number) => indexes[depth] ?? 0,
      },
    },
  };
}

describe('shouldDeleteTableOnLeadingBackspace', () => {
  it('returns true at the leading edge of the first cell in the first row', () => {
    expect(shouldDeleteTableOnLeadingBackspace(createState())).toBe(true);
  });

  it('returns false when the cursor is not at the leading edge', () => {
    expect(shouldDeleteTableOnLeadingBackspace(createState({ parentOffset: 1 }))).toBe(false);
  });

  it('returns false outside the first column', () => {
    expect(
      shouldDeleteTableOnLeadingBackspace(createState({ indexes: { 1: 0, 2: 1 } }))
    ).toBe(false);
  });

  it('returns false outside the first row', () => {
    expect(
      shouldDeleteTableOnLeadingBackspace(createState({ indexes: { 1: 1, 2: 0 } }))
    ).toBe(false);
  });

  it('returns false when the selection is outside a table cell', () => {
    expect(
      shouldDeleteTableOnLeadingBackspace(
        createState({ nodes: ['doc', 'paragraph'] })
      )
    ).toBe(false);
  });

  it('returns the table range for a leading backspace in the first cell', () => {
    expect(findLeadingTableDeleteRange(createState())).toEqual({ from: 5, to: 17 });
  });
});
