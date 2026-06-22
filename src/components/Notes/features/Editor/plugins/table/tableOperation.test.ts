import { describe, expect, it, vi } from 'vitest';

const {
  commandsCtx,
  editorViewCtx,
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  moveColCommand,
  moveRowCommand,
  selectColCommand,
  selectRowCommand,
} = vi.hoisted(() => ({
  commandsCtx: Symbol('commandsCtx'),
  editorViewCtx: Symbol('editorViewCtx'),
  addColAfterCommand: { key: 'addColAfter' },
  addColBeforeCommand: { key: 'addColBefore' },
  addRowAfterCommand: { key: 'addRowAfter' },
  addRowBeforeCommand: { key: 'addRowBefore' },
  deleteSelectedCellsCommand: { key: 'deleteSelectedCells' },
  moveColCommand: { key: 'moveCol' },
  moveRowCommand: { key: 'moveRow' },
  selectColCommand: { key: 'selectCol' },
  selectRowCommand: { key: 'selectRow' },
}));

vi.mock('@milkdown/core', () => ({
  commandsCtx,
  editorViewCtx,
}));

vi.mock('@milkdown/kit/prose/tables', () => ({
  TableMap: {
    get: vi.fn(),
  },
}));

vi.mock('@milkdown/preset-gfm', () => ({
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  moveColCommand,
  moveRowCommand,
  selectColCommand,
  selectRowCommand,
}));

vi.mock('../../../../../../../vendor/milkdown/packages/plugins/preset-gfm/src/index.ts', () => ({
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  moveColCommand,
  moveRowCommand,
  selectColCommand,
  selectRowCommand,
}));

import { useOperation } from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/operation';

function createTextNode(text: string) {
  return {
    childCount: 0,
    child: vi.fn(),
    isLeaf: true,
    isText: true,
    text,
    type: {
      name: 'text',
    },
  };
}

function createCellNode(text: string) {
  const textNode = createTextNode(text);

  return {
    childCount: 1,
    child: (index: number) => {
      if (index !== 0) {
        throw new Error(`Unexpected child index: ${index}`);
      }

      return textNode;
    },
    isLeaf: false,
    isText: false,
    type: {
      name: 'table_cell',
    },
  };
}

function createRowNode(cells: string[]) {
  const cellNodes = cells.map((text) => createCellNode(text));

  return {
    childCount: cellNodes.length,
    child: (index: number) => {
      const cell = cellNodes[index];
      if (!cell) {
        throw new Error(`Unexpected child index: ${index}`);
      }

      return cell;
    },
    isLeaf: false,
    isText: false,
    type: {
      name: 'table_row',
    },
  };
}

function createHarness(
  getPos: () => number | undefined = () => 5,
  tableNode = {
    childCount: 3,
    firstChild: {
      childCount: 3,
    },
  },
  lineHoverIndex: [number, number] = [0, 0],
) {
  const commands = {
    call: vi.fn(),
  };

  const view = {
    editable: true,
    state: {
      doc: {
        nodeAt: vi.fn(() => tableNode),
      },
    },
  };

  const ctx = {
    get: (key: unknown) => {
      if (key === commandsCtx) return commands;
      if (key === editorViewCtx) return view;
      throw new Error(`Unexpected context key: ${String(key)}`);
    },
  };

  const refs = {
    tableWrapperRef: { value: undefined as HTMLDivElement | undefined } as never,
    contentWrapperRef: { value: undefined as HTMLElement | undefined } as never,
    yLineHandleRef: { value: undefined as HTMLDivElement | undefined } as never,
    xLineHandleRef: { value: document.createElement('div') as HTMLDivElement | undefined } as never,
    lineHoverIndex: { value: lineHoverIndex } as never,
  };

  const operation = useOperation(refs, ctx as never, getPos);

  return {
    commands,
    operation,
  };
}

describe('table operation', () => {
  it('moves a column without selecting it afterwards', () => {
    const { commands, operation } = createHarness();

    operation.onMoveCol(0, 2);

    expect(commands.call).toHaveBeenCalledTimes(1);
    expect(commands.call).toHaveBeenCalledWith(moveColCommand.key, {
      pos: 6,
      from: 0,
      to: 2,
      select: false,
    });
  });

  it('moves a row without selecting it afterwards', () => {
    const { commands, operation } = createHarness();

    operation.onMoveRow(0, 2);

    expect(commands.call).toHaveBeenCalledTimes(1);
    expect(commands.call).toHaveBeenCalledWith(moveRowCommand.key, {
      pos: 6,
      from: 0,
      to: 2,
    });
  });

  it('selects the target column before executing a column menu command', () => {
    const { commands, operation } = createHarness();

    operation.onInsertColRight(1);
    operation.onDeleteCol(1);

    expect(commands.call).toHaveBeenNthCalledWith(1, selectColCommand.key, {
      pos: 6,
      index: 1,
    });
    expect(commands.call).toHaveBeenNthCalledWith(2, addColAfterCommand.key);
    expect(commands.call).toHaveBeenNthCalledWith(3, selectColCommand.key, {
      pos: 6,
      index: 1,
    });
    expect(commands.call).toHaveBeenNthCalledWith(4, deleteSelectedCellsCommand.key);
  });

  it('selects the target row before executing a row menu command', () => {
    const { commands, operation } = createHarness();

    operation.onInsertRowBelow(1);
    operation.onDeleteRow(1);

    expect(commands.call).toHaveBeenNthCalledWith(1, selectRowCommand.key, {
      pos: 6,
      index: 1,
    });
    expect(commands.call).toHaveBeenNthCalledWith(2, addRowAfterCommand.key);
    expect(commands.call).toHaveBeenNthCalledWith(3, selectRowCommand.key, {
      pos: 6,
      index: 1,
    });
    expect(commands.call).toHaveBeenNthCalledWith(4, deleteSelectedCellsCommand.key);
  });

  it('does not dispatch commands when getPos throws during a column operation', () => {
    const { commands, operation } = createHarness(() => {
      throw new Error('detached');
    });

    operation.onMoveCol(0, 2);
    operation.onMoveRow(0, 2);
    operation.onInsertColRight(1);
    operation.onInsertRowBelow(1);

    expect(commands.call).not.toHaveBeenCalled();
  });

  it('adds rows and columns from table document shape without DOM collection scans', () => {
    const { commands, operation } = createHarness(
      () => 5,
      {
        childCount: 3,
        firstChild: {
          childCount: 4,
        },
      },
      [3, 4],
    );
    const querySelectorAllSpy = vi.spyOn(Element.prototype, 'querySelectorAll');
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used');
    });

    try {
      operation.onAddRow();
      operation.onAddCol();
    } finally {
      arrayFromSpy.mockRestore();
      querySelectorAllSpy.mockRestore();
    }

    expect(commands.call).toHaveBeenNthCalledWith(1, selectRowCommand.key, {
      pos: 6,
      index: 2,
    });
    expect(commands.call).toHaveBeenNthCalledWith(2, addRowAfterCommand.key);
    expect(commands.call).toHaveBeenNthCalledWith(3, selectRowCommand.key, {
      pos: 6,
      index: 3,
    });
    expect(commands.call).toHaveBeenNthCalledWith(4, selectColCommand.key, {
      pos: 6,
      index: 3,
    });
    expect(commands.call).toHaveBeenNthCalledWith(5, addColAfterCommand.key);
    expect(commands.call).toHaveBeenNthCalledWith(6, selectColCommand.key, {
      pos: 6,
      index: 4,
    });
    expect(querySelectorAllSpy).not.toHaveBeenCalled();
  });

  it('allows shrinking from two rows down to one row when the last row is empty', () => {
    const tableNode = {
      childCount: 2,
      firstChild: {
        childCount: 2,
      },
      child: (index: number) => {
        const rows = [
          createRowNode(['filled', 'filled']),
          createRowNode(['', '']),
        ];
        const row = rows[index];
        if (!row) {
          throw new Error(`Unexpected child index: ${index}`);
        }

        return row;
      },
    };

    const { commands, operation } = createHarness(() => 5, tableNode);

    operation.onShrinkRow();

    expect(commands.call).toHaveBeenNthCalledWith(1, selectRowCommand.key, {
      pos: 6,
      index: 1,
    });
    expect(commands.call).toHaveBeenNthCalledWith(2, deleteSelectedCellsCommand.key);
  });
});
