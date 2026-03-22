import { describe, expect, it, vi } from 'vitest';

vi.mock('@milkdown/kit/prose/state', () => {
  class MockTextSelection {
    static create(doc: MockDoc, from: number, to = from) {
      return new MockTextSelection(doc, from, to);
    }

    from: number;
    to: number;
    anchor: number;
    head: number;
    empty: boolean;
    $from: MockResolvedPos;
    $to: MockResolvedPos;

    constructor(doc: MockDoc, from: number, to: number) {
      this.from = from;
      this.to = to;
      this.anchor = from;
      this.head = to;
      this.empty = from === to;
      this.$from = doc.resolve(from);
      this.$to = doc.resolve(to);
    }
  }

  class MockNodeSelection {
    static create(doc: MockDoc, from: number) {
      const node = doc.nodeAt(from);
      if (!node) throw new Error(`Missing node at ${from}`);
      return new MockNodeSelection(doc, from, node);
    }

    from: number;
    to: number;
    anchor: number;
    head: number;
    empty: boolean;
    node: MockNode;
    $from: MockResolvedPos;
    $to: MockResolvedPos;

    constructor(doc: MockDoc, from: number, node: MockNode) {
      this.from = from;
      this.to = from + node.nodeSize;
      this.anchor = from;
      this.head = this.to;
      this.empty = false;
      this.node = node;
      this.$from = doc.resolve(from);
      this.$to = doc.resolve(this.to);
    }
  }
  class MockAllSelection {
    static create(doc: MockDoc) {
      return new MockAllSelection(doc);
    }

    from: number;
    to: number;
    anchor: number;
    head: number;
    empty: boolean;
    $from: MockResolvedPos;
    $to: MockResolvedPos;

    constructor(doc: MockDoc) {
      this.from = 0;
      this.to = doc.content.size;
      this.anchor = 0;
      this.head = this.to;
      this.empty = false;
      this.$from = doc.resolve(0);
      this.$to = doc.resolve(this.to);
    }
  }

  return {
    TextSelection: MockTextSelection,
    NodeSelection: MockNodeSelection,
    AllSelection: MockAllSelection,
  };
});

vi.mock('@milkdown/kit/prose/tables', () => {
  class MockCellSelection {
    static colSelection = vi.fn();
    static rowSelection = vi.fn();

    $anchorCell: { pos: number };
    $headCell: { pos: number };

    constructor(anchorCell: { pos: number }, headCell: { pos: number }) {
      this.$anchorCell = anchorCell;
      this.$headCell = headCell;
      this.$from = {
        depth: 2,
        node: (depth: number) => {
          if (depth === 1) {
            return { nodeSize: 24, type: { name: 'table' } };
          }
          return { type: { name: 'paragraph' } };
        },
        before: () => 10,
      };
    }

    $from: {
      depth: number;
      node: (depth: number) => { nodeSize?: number; type: { name: string } };
      before: (depth: number) => number;
    };

    isColSelection() {
      return true;
    }

    isRowSelection() {
      return true;
    }
  }

  return {
    CellSelection: MockCellSelection,
    findTable: vi.fn(() => ({
      node: {},
      start: 10,
      pos: 10,
    })),
    TableMap: {
      get: vi.fn(() => ({
        width: 1,
        height: 2,
        cellsInRect: () => [2, 20],
      })),
    },
  };
});

import * as proseState from '@milkdown/kit/prose/state';
import * as proseTables from '@milkdown/kit/prose/tables';

import { handleTableSelectAll } from './tableSelectAll';

const { NodeSelection, TextSelection } = proseState;
const CellSelection = (
  proseTables as typeof proseTables & {
    CellSelection: new (
      anchorCell: { pos: number },
      headCell: { pos: number }
    ) => {
      from?: number;
      to?: number;
      $anchorCell: { pos: number };
      $headCell: { pos: number };
      isColSelection: () => boolean;
      isRowSelection: () => boolean;
    };
  }
).CellSelection;
const AllSelection = (
  proseState as typeof proseState & {
    AllSelection: new (...args: never[]) => {
      from: number;
      to: number;
    };
  }
).AllSelection;

type MockNode = {
  nodeSize: number;
  type: { name: string };
};

type MockTextblockNode = {
  isTextblock: boolean;
  type: { name: string };
};

type MockResolvedPos = {
  depth: number;
  parent: MockTextblockNode;
  node: (depth: number) => MockNode | MockTextblockNode;
  before: (depth: number) => number;
  start: () => number;
  end: () => number;
};

type MockDoc = {
  content: { size: number };
  resolve: (pos: number) => MockResolvedPos;
  nodeAt: (pos: number) => MockNode | null;
};

function createTextSelectionDoc() {
  const tablePos = 10;
  const tableNode: MockNode = {
    nodeSize: 24,
    type: { name: 'table' },
  };
  const paragraphNode: MockTextblockNode = {
    isTextblock: true,
    type: { name: 'paragraph' },
  };
  const insideTablePos: MockResolvedPos = {
    depth: 2,
    parent: paragraphNode,
    node: (depth: number) => {
      if (depth === 1) return tableNode;
      return paragraphNode;
    },
    before: (depth: number) => (depth === 1 ? tablePos : 0),
    start: () => 13,
    end: () => 19,
  };
  const outsideTablePos: MockResolvedPos = {
    depth: 1,
    parent: paragraphNode,
    node: () => paragraphNode,
    before: () => 0,
    start: () => 1,
    end: () => 5,
  };
  const doc: MockDoc = {
    content: { size: 80 },
    resolve: (pos: number) => {
      if (pos >= 13 && pos <= 34) return insideTablePos;
      return outsideTablePos;
    },
    nodeAt: (pos: number) => (pos === tablePos ? tableNode : null),
  };

  return {
    doc,
    tableNode,
    tablePos,
  };
}

function createView(selection: InstanceType<typeof TextSelection> | InstanceType<typeof NodeSelection> | InstanceType<typeof AllSelection>, doc: MockDoc) {
  const dom = {
    querySelectorAll: vi.fn(() => []),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
    },
    ownerDocument: {
      documentElement: {
        removeAttribute: vi.fn(),
      },
      body: {
        removeAttribute: vi.fn(),
      },
      getElementById: vi.fn(() => null),
      getSelection: vi.fn(() => ({
        rangeCount: 0,
        removeAllRanges: vi.fn(),
      })),
    },
  };
  const tr = {
    selection: null as unknown,
    setSelection(nextSelection: unknown) {
      this.selection = nextSelection;
      return this;
    },
    scrollIntoView() {
      return this;
    },
  };
  const view = {
    dom,
    state: {
      selection,
      tr,
      doc,
    },
    dispatch: vi.fn((nextTr: typeof tr) => {
      view.state.selection = nextTr.selection as typeof selection;
    }),
  };

  return view;
}

function createShortcutEvent() {
  return {
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    key: 'a',
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('handleTableSelectAll', () => {
  it('selects the current cell textblock first', () => {
    const { doc } = createTextSelectionDoc();
    const selection = TextSelection.create(doc as never, 15, 17);
    const view = createView(selection, doc);
    const event = createShortcutEvent();

    expect(handleTableSelectAll(view as never, event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(view.dispatch).toHaveBeenCalledOnce();
    expect(view.state.selection).toBeInstanceOf(TextSelection);
    expect(view.state.selection.from).toBe(13);
    expect(view.state.selection.to).toBe(19);
  });

  it('selects the whole table after the current textblock is already selected', () => {
    const { doc } = createTextSelectionDoc();
    const selection = TextSelection.create(doc as never, 13, 19);
    const view = createView(selection, doc);
    const event = createShortcutEvent();

    expect(handleTableSelectAll(view as never, event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(view.dispatch).toHaveBeenCalledOnce();
    expect(view.state.selection).not.toBeInstanceOf(NodeSelection);
    expect(view.state.selection).toBeInstanceOf(CellSelection);
  });

  it('selects the whole document after the table is already selected', () => {
    const { doc } = createTextSelectionDoc();
    const selection = new CellSelection({ pos: 12 }, { pos: 30 });
    const view = createView(selection, doc);
    const event = createShortcutEvent();

    expect(handleTableSelectAll(view as never, event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(view.dispatch).toHaveBeenCalledOnce();
    expect(view.state.selection).toBeInstanceOf(AllSelection);
    expect(view.state.selection.from).toBe(0);
    expect(view.state.selection.to).toBe(doc.content.size);
  });

  it('does not intercept select-all outside of tables', () => {
    const { doc } = createTextSelectionDoc();
    const selection = TextSelection.create(doc as never, 2, 4);
    const view = createView(selection, doc);
    const event = createShortcutEvent();

    expect(handleTableSelectAll(view as never, event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
