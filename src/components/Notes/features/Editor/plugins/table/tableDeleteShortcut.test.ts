import { describe, expect, it } from 'vitest';
import {
  findAdjacentTableParagraphDeleteRange,
  findLeadingTableDeleteRange,
  shouldDeleteTableOnLeadingBackspace,
  shouldDeleteTrailingEmptyRowOnDelete,
} from './tableDeleteShortcut';

type TestNode = {
  type: { name: string };
  childCount: number;
  child: (index: number) => TestNode;
  isLeaf: boolean;
  isText: boolean;
  text: string | null;
};

function createLeafNode(name: string, text?: string | null): TestNode {
  return {
    type: { name },
    childCount: 0,
    child: () => {
      throw new Error('leaf has no children');
    },
    isLeaf: true,
    isText: name === 'text',
    text: text ?? null,
  };
}

function createBranchNode(name: string, children: TestNode[] = []): TestNode {
  return {
    type: { name },
    childCount: children.length,
    child: (index: number) => children[index],
    isLeaf: false,
    isText: false,
    text: null,
  };
}

function createState({
  empty = true,
  parentOffset = 0,
  parentIsTextblock = true,
  nodes = ['doc', 'table', 'table_header_row', 'table_header', 'paragraph'],
  indexes = { 1: 0, 2: 0 },
  beforeValues = { 1: 5 },
  afterValues = { 1: 17 },
  overrides = {},
}: {
  empty?: boolean;
  parentOffset?: number;
  parentIsTextblock?: boolean;
  nodes?: string[];
  indexes?: Record<number, number>;
  beforeValues?: Record<number, number>;
  afterValues?: Record<number, number>;
  overrides?: Record<number, TestNode>;
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
          if (depth == null) return 0;
          return beforeValues[depth] ?? 0;
        },
        after: (depth?: number) => {
          if (depth == null) return 0;
          return afterValues[depth] ?? 0;
        },
        node: (depth: number) =>
          overrides[depth] ??
          createBranchNode(nodes[depth]),
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

  it('returns true when the cursor is inside an empty trailing row', () => {
    const emptyCell = createBranchNode('table_cell', [
      createBranchNode('paragraph', [createLeafNode('text', '   ')]),
    ]);
    const trailingRow = createBranchNode('table_row', [emptyCell, emptyCell]);
    const table = createBranchNode('table', [
      createBranchNode('table_header_row', [createBranchNode('table_header')]),
      trailingRow,
    ]);

    expect(
      shouldDeleteTrailingEmptyRowOnDelete(
        createState({
          nodes: ['doc', 'table', 'table_row', 'table_cell', 'paragraph'],
          indexes: { 1: 1, 2: 0 },
          overrides: {
            1: table,
            2: trailingRow,
          },
        })
      )
    ).toBe(true);
  });

  it('returns false when the trailing row contains content', () => {
    const filledCell = createBranchNode('table_cell', [
      createBranchNode('paragraph', [createLeafNode('text', 'value')]),
    ]);
    const trailingRow = createBranchNode('table_row', [filledCell]);
    const table = createBranchNode('table', [
      createBranchNode('table_header_row', [createBranchNode('table_header')]),
      trailingRow,
    ]);

    expect(
      shouldDeleteTrailingEmptyRowOnDelete(
        createState({
          nodes: ['doc', 'table', 'table_row', 'table_cell', 'paragraph'],
          indexes: { 1: 1, 2: 0 },
          overrides: {
            1: table,
            2: trailingRow,
          },
        })
      )
    ).toBe(false);
  });

  it('returns false when the cursor is not in the trailing row', () => {
    const emptyCell = createBranchNode('table_cell', [
      createBranchNode('paragraph', [createLeafNode('text', '   ')]),
    ]);
    const middleRow = createBranchNode('table_row', [emptyCell]);
    const trailingRow = createBranchNode('table_row', [emptyCell]);
    const table = createBranchNode('table', [
      createBranchNode('table_header_row', [createBranchNode('table_header')]),
      middleRow,
      trailingRow,
    ]);

    expect(
      shouldDeleteTrailingEmptyRowOnDelete(
        createState({
          nodes: ['doc', 'table', 'table_row', 'table_cell', 'paragraph'],
          indexes: { 1: 1, 2: 0 },
          overrides: {
            1: table,
            2: middleRow,
          },
        })
      )
    ).toBe(false);
  });

  it('returns a delete range for an empty paragraph immediately after a table', () => {
    const table = createBranchNode('table', [
      createBranchNode('table_header_row', [createBranchNode('table_header')]),
    ]);
    const paragraph = createBranchNode('paragraph');
    const doc = createBranchNode('doc', [table, paragraph]);

    expect(
      findAdjacentTableParagraphDeleteRange(
        createState({
          nodes: ['doc', 'paragraph'],
          indexes: { 0: 1 },
          beforeValues: { 1: 18 },
          afterValues: { 1: 20 },
          overrides: {
            0: doc,
            1: paragraph,
          },
        }),
        -1
      )
    ).toEqual({ from: 18, to: 20, searchDir: -1 });
  });

  it('returns a delete range for an empty paragraph immediately before a table', () => {
    const table = createBranchNode('table', [
      createBranchNode('table_header_row', [createBranchNode('table_header')]),
    ]);
    const paragraph = createBranchNode('paragraph');
    const doc = createBranchNode('doc', [paragraph, table]);

    expect(
      findAdjacentTableParagraphDeleteRange(
        createState({
          nodes: ['doc', 'paragraph'],
          indexes: { 0: 0 },
          beforeValues: { 1: 5 },
          afterValues: { 1: 7 },
          overrides: {
            0: doc,
            1: paragraph,
          },
        }),
        1
      )
    ).toEqual({ from: 5, to: 7, searchDir: 1 });
  });
});
