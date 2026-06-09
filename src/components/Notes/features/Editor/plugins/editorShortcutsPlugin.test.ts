import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_EDITOR_SELECTION_TEXT_CHARS } from './shared/selectionTextLimits';

const mocks = vi.hoisted(() => ({
  convertBlockType: vi.fn(),
  toggleMark: vi.fn(),
  createEmptyTableNode: vi.fn(),
  createOpenMathEditorState: vi.fn(),
  addRowAfter: vi.fn(),
  deleteRow: vi.fn(),
  sinkListItemCommand: vi.fn(),
  liftListItemCommand: vi.fn(),
  sinkListItem: vi.fn(),
  liftListItem: vi.fn(),
  textSelectionCreate: vi.fn(),
}));

vi.mock('@milkdown/kit/utils', () => ({
  $prose: (factory: unknown) => factory,
}));

vi.mock('@milkdown/kit/prose/state', () => ({
  Plugin: class Plugin {
    constructor(spec: unknown) {
      Object.assign(this, spec);
    }
  },
  PluginKey: class PluginKey {
    name: string;

    constructor(name: string) {
      this.name = name;
    }
  },
  TextSelection: {
    create: mocks.textSelectionCreate,
  },
}));

vi.mock('@milkdown/kit/prose/tables', () => ({
  addRowAfter: mocks.addRowAfter,
  deleteRow: mocks.deleteRow,
}));

vi.mock('@milkdown/kit/prose/schema-list', () => ({
  sinkListItem: mocks.sinkListItem,
  liftListItem: mocks.liftListItem,
}));

vi.mock('./floating-toolbar/blockCommands', () => ({
  convertBlockType: mocks.convertBlockType,
}));

vi.mock('./floating-toolbar/markCommands', () => ({
  toggleMark: mocks.toggleMark,
}));

vi.mock('./table/pipeTableShortcut', () => ({
  createEmptyTableNode: mocks.createEmptyTableNode,
}));

vi.mock('./math/mathEditorState', () => ({
  createOpenMathEditorState: mocks.createOpenMathEditorState,
}));

import { handleEditorShortcut } from './editorShortcutsPlugin';

function createEvent(key: string, options: Partial<KeyboardEvent> = {}) {
  return {
    key,
    ctrlKey: true,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...options,
  } as unknown as KeyboardEvent & {
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
  };
}

function createTableNode() {
  return {
    type: { name: 'table' },
    firstChild: {
      firstChild: {
        type: { name: 'table_header' },
      },
    },
  };
}

function createTransaction() {
  const tr = {
    doc: {
      descendants: vi.fn(() => {
        throw new Error('doc.descendants should not be used after inserting shortcut tables');
      }),
      nodeAt: vi.fn(() => createTableNode()),
    },
    mapping: { map: vi.fn((pos: number) => pos) },
    replaceRangeWith: vi.fn(() => tr),
    scrollIntoView: vi.fn(() => tr),
    setSelection: vi.fn(() => tr),
    setMeta: vi.fn(() => tr),
    removeStoredMark: vi.fn(() => tr),
    removeMark: vi.fn(() => tr),
  };
  return tr;
}

function createView(options: {
  selection?: {
    from: number;
    to: number;
    empty: boolean;
    $from?: { parent: { type: { name: string }; attrs: { level: number } } };
  };
  doc?: { textBetween: ReturnType<typeof vi.fn>; content?: { size: number } };
} = {}) {
  const tr = createTransaction();
  const selection = options.selection ?? {
    from: 1,
    to: 1,
    empty: true,
    $from: {
      parent: { type: { name: 'heading' }, attrs: { level: 2 } },
    },
  };
  return {
    state: {
      schema: {
        nodes: {
          list_item: { name: 'list_item' },
          math_block: { create: vi.fn(() => ({ type: 'math_block' })) },
        },
        marks: {
          strong: { name: 'strong' },
          emphasis: { name: 'emphasis' },
        },
      },
      selection,
      doc: options.doc ?? {
        textBetween: vi.fn(() => 'x^2'),
      },
      tr,
    },
    dispatch: vi.fn(),
    focus: vi.fn(),
    coordsAtPos: vi.fn(() => ({ left: 10, bottom: 20 })),
    dom: {
      dispatchEvent: vi.fn(),
    },
  };
}

function expectHandled(event: ReturnType<typeof createEvent>) {
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(event.stopPropagation).toHaveBeenCalledOnce();
}

describe('handleEditorShortcut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createEmptyTableNode.mockReturnValue(createTableNode());
    mocks.createOpenMathEditorState.mockReturnValue({ open: true });
    mocks.addRowAfter.mockReturnValue(true);
    mocks.deleteRow.mockReturnValue(true);
    mocks.sinkListItemCommand.mockReturnValue(true);
    mocks.liftListItemCommand.mockReturnValue(true);
    mocks.sinkListItem.mockReturnValue(mocks.sinkListItemCommand);
    mocks.liftListItem.mockReturnValue(mocks.liftListItemCommand);
    mocks.textSelectionCreate.mockReturnValue({ type: 'selection' });
  });

  it('handles paragraph and heading shortcuts', () => {
    for (const [key, blockType] of [
      ['0', 'paragraph'],
      ['1', 'heading1'],
      ['2', 'heading2'],
      ['3', 'heading3'],
      ['4', 'heading4'],
      ['5', 'heading5'],
      ['6', 'heading6'],
    ] as const) {
      const view = createView();
      const event = createEvent(key);
      expect(handleEditorShortcut(view as never, event)).toBe(true);
      expect(mocks.convertBlockType).toHaveBeenLastCalledWith(view, blockType);
      expectHandled(event);
    }
  });

  it('handles heading level changes', () => {
    const raiseView = createView();
    const raiseEvent = createEvent('=');
    expect(handleEditorShortcut(raiseView as never, raiseEvent)).toBe(true);
    expect(mocks.convertBlockType).toHaveBeenLastCalledWith(raiseView, 'heading1');
    expectHandled(raiseEvent);

    const lowerView = createView();
    const lowerEvent = createEvent('-');
    expect(handleEditorShortcut(lowerView as never, lowerEvent)).toBe(true);
    expect(mocks.convertBlockType).toHaveBeenLastCalledWith(lowerView, 'heading3');
    expectHandled(lowerEvent);
  });

  it('handles table shortcuts', () => {
    const insertView = createView();
    const insertEvent = createEvent('t');
    expect(handleEditorShortcut(insertView as never, insertEvent)).toBe(true);
    expect(mocks.createEmptyTableNode).toHaveBeenCalledWith(insertView.state.schema, 3);
    expect(insertView.state.tr.doc.nodeAt).toHaveBeenCalledWith(1);
    expect(insertView.state.tr.doc.descendants).not.toHaveBeenCalled();
    expect(mocks.textSelectionCreate).toHaveBeenCalledWith(insertView.state.tr.doc, 5);
    expect(insertView.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(insertView.dispatch).toHaveBeenCalledOnce();
    expectHandled(insertEvent);

    const addRowView = createView();
    const addRowEvent = createEvent('Enter');
    expect(handleEditorShortcut(addRowView as never, addRowEvent)).toBe(true);
    expect(addRowView.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(mocks.addRowAfter).toHaveBeenCalledWith(addRowView.state, addRowView.dispatch);
    expectHandled(addRowEvent);

    const deleteRowView = createView();
    const deleteRowEvent = createEvent('Backspace', { shiftKey: true });
    expect(handleEditorShortcut(deleteRowView as never, deleteRowEvent)).toBe(true);
    expect(deleteRowView.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(mocks.deleteRow).toHaveBeenCalledWith(deleteRowView.state, deleteRowView.dispatch);
    expectHandled(deleteRowEvent);
  });

  it('handles block conversion shortcuts', () => {
    for (const [key, blockType] of [
      ['K', 'codeBlock'],
      ['[', 'orderedList'],
      [']', 'bulletList'],
    ] as const) {
      const view = createView();
      const event = createEvent(key, { shiftKey: true });
      expect(handleEditorShortcut(view as never, event)).toBe(true);
      expect(mocks.convertBlockType).toHaveBeenLastCalledWith(view, blockType);
      expectHandled(event);
    }
  });

  it('handles math block shortcuts', () => {
    const view = createView();
    const event = createEvent('M', { shiftKey: true });
    expect(handleEditorShortcut(view as never, event)).toBe(true);
    expect(view.state.schema.nodes.math_block.create).toHaveBeenCalledWith({ latex: '' });
    expect(view.state.tr.setMeta).toHaveBeenCalledWith(expect.anything(), { open: true });
    expect(view.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(view.dispatch).toHaveBeenCalledOnce();
    expectHandled(event);
  });

  it('does not read oversized selected text when creating a math block shortcut', () => {
    const textBetween = vi.fn(() => {
      throw new Error('oversized math shortcut selection should not be read');
    });
    const view = createView({
      selection: {
        from: 1,
        to: MAX_EDITOR_SELECTION_TEXT_CHARS + 2,
        empty: false,
        $from: {
          parent: { type: { name: 'paragraph' }, attrs: { level: 0 } },
        },
      },
      doc: {
        content: { size: MAX_EDITOR_SELECTION_TEXT_CHARS + 10 },
        textBetween,
      },
    });
    const event = createEvent('M', { shiftKey: true });

    expect(handleEditorShortcut(view as never, event)).toBe(true);
    expect(textBetween).not.toHaveBeenCalled();
    expect(view.state.schema.nodes.math_block.create).toHaveBeenCalledWith({ latex: '' });
    expectHandled(event);
  });

  it('handles list indent shortcuts', () => {
    const indentView = createView();
    const indentEvent = createEvent(']');
    expect(handleEditorShortcut(indentView as never, indentEvent)).toBe(true);
    expect(indentView.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(mocks.sinkListItem).toHaveBeenCalledWith(indentView.state.schema.nodes.list_item);
    expect(mocks.sinkListItemCommand).toHaveBeenCalledWith(indentView.state, indentView.dispatch);
    expectHandled(indentEvent);

    const outdentView = createView();
    const outdentEvent = createEvent('[');
    expect(handleEditorShortcut(outdentView as never, outdentEvent)).toBe(true);
    expect(outdentView.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(mocks.liftListItem).toHaveBeenCalledWith(outdentView.state.schema.nodes.list_item);
    expect(mocks.liftListItemCommand).toHaveBeenCalledWith(outdentView.state, outdentView.dispatch);
    expectHandled(outdentEvent);
  });

  it('handles format shortcuts owned by the editor plugin', () => {
    for (const [key, markName] of [
      ['5', 'strike_through'],
      ['`', 'inlineCode'],
    ] as const) {
      const view = createView();
      const event = createEvent(key, { shiftKey: true });
      expect(handleEditorShortcut(view as never, event)).toBe(true);
      expect(mocks.toggleMark).toHaveBeenLastCalledWith(view, markName);
      expectHandled(event);
    }
  });

  it('handles clear formatting and ignores non-modifier keys', () => {
    const view = createView();
    const clearEvent = createEvent('\\');
    expect(handleEditorShortcut(view as never, clearEvent)).toBe(true);
    expect(view.state.tr.removeStoredMark).toHaveBeenCalledTimes(2);
    expect(view.dom.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'editor:block-user-input',
    }));
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
    expectHandled(clearEvent);

    const ignoredEvent = createEvent('1', { ctrlKey: false });
    expect(handleEditorShortcut(createView() as never, ignoredEvent)).toBe(false);
    expect(ignoredEvent.preventDefault).not.toHaveBeenCalled();
  });
});
