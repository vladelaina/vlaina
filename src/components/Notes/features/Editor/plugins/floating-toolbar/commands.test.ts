import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copySelectionToClipboard, convertBlockType, setBgColor, setTextAlignment, setTextColor } from './commands';

const mockSetBlockType = vi.fn();
const mockWrapIn = vi.fn();
const mockLift = vi.fn();
const mockTextSelectionCreate = vi.fn();

vi.mock('@milkdown/kit/prose/commands', () => ({
  setBlockType: (...args: unknown[]) => mockSetBlockType(...args),
  wrapIn: (...args: unknown[]) => mockWrapIn(...args),
  lift: (...args: unknown[]) => mockLift(...args),
}));

vi.mock('@milkdown/kit/prose/state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@milkdown/kit/prose/state')>();
  return {
    ...actual,
    TextSelection: {
      ...actual.TextSelection,
      create: (...args: unknown[]) => mockTextSelectionCreate(...args),
    },
  };
});

function createListToHeadingView(listType: 'bullet_list' | 'ordered_list', checked: boolean | null = null) {
  const initialState: any = {
    selection: {
      $from: {
        depth: 3,
        before: vi.fn(() => 6),
        node: vi.fn((depth: number) => {
          if (depth === 2) {
            return {
              type: { name: 'list_item' },
              attrs: {
                label: listType === 'ordered_list' ? '1.' : '•',
                listType: listType === 'ordered_list' ? 'ordered' : 'bullet',
                checked,
              },
            };
          }
          if (depth === 1) {
            return { type: { name: listType } };
          }
          return { type: { name: 'paragraph' } };
        }),
      },
    },
    schema: {
      nodes: {
        heading: { name: 'heading' },
      },
    },
  };
  const nextState: any = {
    ...initialState,
    selection: {
      $from: {
        depth: 1,
        node: vi.fn(() => ({ type: { name: 'doc' } })),
      },
    },
  };
  const dispatch = vi.fn();
  const view: any = {
    state: initialState,
    dispatch,
    focus: vi.fn(),
  };

  mockLift.mockImplementation(() => {
    view.state = nextState;
    return true;
  });

  const applyHeading = vi.fn();
  mockSetBlockType.mockReturnValue(applyHeading);

  return { applyHeading, dispatch, initialState, nextState, view };
}

describe('floating toolbar commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('unwraps blockquote before converting to a heading', () => {
    const initialState: any = {
      selection: {
        $from: {
          depth: 2,
          node: vi.fn((depth: number) => {
            if (depth === 1) {
              return { type: { name: 'blockquote' } };
            }
            return { type: { name: 'paragraph' } };
          }),
        },
      },
      schema: {
        nodes: {
          heading: { name: 'heading' },
        },
      },
    };
    const nextState: any = {
      ...initialState,
      selection: {
        $from: {
          depth: 1,
          node: vi.fn(() => ({ type: { name: 'doc' } })),
        },
      },
    };

    const dispatch = vi.fn();
    const view: any = {
      state: initialState,
      dispatch,
      focus: vi.fn(),
    };

    mockLift.mockImplementation(() => {
      view.state = nextState;
      return true;
    });

    const applyHeading = vi.fn();
    mockSetBlockType.mockReturnValue(applyHeading);

    convertBlockType(view, 'heading2');

    expect(mockLift).toHaveBeenCalledWith(initialState, dispatch);
    expect(mockSetBlockType).toHaveBeenCalledWith(initialState.schema.nodes.heading, { level: 2 });
    expect(applyHeading).toHaveBeenCalledWith(nextState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it('unwraps list item before converting to a heading', () => {
    const { applyHeading, dispatch, initialState, nextState, view } = createListToHeadingView('bullet_list');

    convertBlockType(view, 'heading3');

    expect(mockLift).toHaveBeenCalledWith(initialState, dispatch);
    expect(mockSetBlockType).toHaveBeenCalledWith(initialState.schema.nodes.heading, { level: 3 });
    expect(applyHeading).toHaveBeenCalledWith(nextState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it('unwraps ordered list item before converting to a heading', () => {
    const { applyHeading, dispatch, initialState, nextState, view } = createListToHeadingView('ordered_list');

    convertBlockType(view, 'heading2');

    expect(mockLift).toHaveBeenCalledWith(initialState, dispatch);
    expect(mockSetBlockType).toHaveBeenCalledWith(initialState.schema.nodes.heading, { level: 2 });
    expect(applyHeading).toHaveBeenCalledWith(nextState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it('unwraps task list item before converting to a heading', () => {
    const { applyHeading, dispatch, initialState, nextState, view } = createListToHeadingView(
      'bullet_list',
      false
    );

    convertBlockType(view, 'heading1');

    expect(mockLift).toHaveBeenCalledWith(initialState, dispatch);
    expect(mockSetBlockType).toHaveBeenCalledWith(initialState.schema.nodes.heading, { level: 1 });
    expect(applyHeading).toHaveBeenCalledWith(nextState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it('normalizes heading to paragraph before wrapping in a bullet list', () => {
    const initialState: any = {
      selection: {
        $from: {
          depth: 1,
          parent: { type: { name: 'heading' } },
          node: vi.fn(() => ({ type: { name: 'doc' } })),
        },
      },
      schema: {
        nodes: {
          paragraph: { name: 'paragraph' },
          bullet_list: { name: 'bullet_list' },
        },
      },
    };
    const normalizedState: any = {
      ...initialState,
      selection: {
        $from: {
          depth: 1,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn(() => ({ type: { name: 'doc' } })),
        },
      },
    };

    const dispatch = vi.fn();
    const view: any = {
      state: initialState,
      dispatch,
      focus: vi.fn(),
    };

    const applyParagraph = vi.fn(() => {
      view.state = normalizedState;
      return true;
    });
    const applyBulletList = vi.fn(() => true);

    mockSetBlockType.mockReturnValue(applyParagraph);
    mockWrapIn.mockReturnValue(applyBulletList);

    convertBlockType(view, 'bulletList');

    expect(mockSetBlockType).toHaveBeenCalledWith(initialState.schema.nodes.paragraph);
    expect(applyParagraph).toHaveBeenCalledWith(initialState, dispatch);
    expect(mockWrapIn).toHaveBeenCalledWith(initialState.schema.nodes.bullet_list);
    expect(applyBulletList).toHaveBeenCalledWith(normalizedState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it('scopes list conversion inside a blockquote to the selected text block', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: {},
      nodeSize: 30,
    };
    const initialSelection: any = {
      empty: false,
      from: 10,
      to: 90,
      $from: {
        depth: 2,
        parent: paragraphNode,
        before: vi.fn((depth?: number) => (depth === 2 ? 10 : 1)),
        node: vi.fn((depth: number) => {
          if (depth === 2) return paragraphNode;
          if (depth === 1) return { type: { name: 'blockquote' } };
          return { type: { name: 'doc' } };
        }),
      },
      $to: {
        depth: 2,
        parent: paragraphNode,
        before: vi.fn((depth?: number) => (depth === 2 ? 10 : 1)),
        node: vi.fn((depth: number) => {
          if (depth === 2) return paragraphNode;
          if (depth === 1) return { type: { name: 'blockquote' } };
          return { type: { name: 'doc' } };
        }),
      },
    };
    const scopedSelection: any = {
      ...initialSelection,
      from: 11,
      to: 39,
    };
    const liftedState: any = {
      selection: {
        $from: {
          depth: 1,
          parent: paragraphNode,
          node: vi.fn(() => ({ type: { name: 'doc' } })),
        },
      },
      schema: {
        nodes: {
          paragraph: { name: 'paragraph' },
          bullet_list: { name: 'bullet_list' },
        },
      },
    };
    const tr: any = {
      setSelection: vi.fn(function (this: any, selection: any) {
        this._selection = selection;
        return this;
      }),
      setMeta: vi.fn(function (this: any) {
        return this;
      }),
    };
    const state: any = {
      selection: initialSelection,
      schema: {
        nodes: {
          paragraph: { name: 'paragraph' },
          bullet_list: { name: 'bullet_list' },
        },
      },
      doc: {
        content: { size: 100 },
        nodeAt: vi.fn((pos: number) => (pos === 10 ? paragraphNode : null)),
      },
      tr,
    };
    const dispatch = vi.fn((nextTr: any) => {
      if (nextTr?._selection) {
        view.state = {
          ...view.state,
          selection: nextTr._selection,
        };
      }
    });
    const view: any = {
      state,
      dispatch,
      focus: vi.fn(),
    };
    const applyBulletList = vi.fn(() => true);

    mockTextSelectionCreate.mockReturnValue(scopedSelection);
    mockLift.mockImplementation(() => {
      view.state = liftedState;
      return true;
    });
    mockWrapIn.mockReturnValue(applyBulletList);

    convertBlockType(view, 'bulletList');

    expect(mockTextSelectionCreate).toHaveBeenCalledWith(state.doc, 11, 39);
    expect(tr.setSelection).toHaveBeenCalledWith(scopedSelection);
    expect(mockLift).toHaveBeenCalledWith(expect.objectContaining({ selection: scopedSelection }), dispatch);
    expect(mockWrapIn).toHaveBeenCalledWith(state.schema.nodes.bullet_list);
    expect(applyBulletList).toHaveBeenCalledWith(liftedState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts current block to a task list by wrapping bullet list and marking list item unchecked', () => {
    const listItemNode = {
      type: { name: 'list_item' },
      attrs: { label: '•', listType: 'bullet', spread: true, checked: null },
    };
    const initialState: any = {
      selection: {
        $from: {
          depth: 1,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn((depth: number) => {
            if (depth === 1) {
              return listItemNode;
            }
            return { type: { name: 'doc' } };
          }),
          before: vi.fn(() => 4),
        },
      },
      schema: {
        nodes: {
          paragraph: { name: 'paragraph' },
          bullet_list: { name: 'bullet_list' },
        },
      },
      tr: {
        setNodeMarkup: vi.fn(() => 'task-tr'),
      },
    };

    const dispatch = vi.fn();
    const view: any = {
      state: initialState,
      dispatch,
      focus: vi.fn(),
    };

    mockWrapIn.mockReturnValue(vi.fn(() => true));

    convertBlockType(view, 'taskList');

    expect(mockWrapIn).toHaveBeenCalledWith(initialState.schema.nodes.bullet_list);
    expect(initialState.tr.setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
      label: '•',
      listType: 'bullet',
      spread: true,
      checked: false,
    });
    expect(dispatch).toHaveBeenCalledWith('task-tr');
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts a task list item back to a bullet list by clearing checked', () => {
    const listItemNode = {
      type: { name: 'list_item' },
      attrs: { label: '•', listType: 'bullet', spread: true, checked: false },
    };
    const bulletListNode = {
      type: { name: 'bullet_list' },
      attrs: { spread: false },
    };
    const tr = {
      setNodeMarkup: vi.fn(() => tr),
    };
    const state: any = {
      selection: {
        $from: {
          depth: 3,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn((depth: number) => {
            if (depth === 2) return listItemNode;
            if (depth === 1) return bulletListNode;
            return { type: { name: 'doc' } };
          }),
          before: vi.fn((depth?: number) => (depth === 2 ? 6 : 2)),
        },
      },
      schema: {
        nodes: {
          bullet_list: { name: 'bullet_list' },
        },
      },
      tr,
    };
    const dispatch = vi.fn();
    const view: any = { state, dispatch, focus: vi.fn() };

    convertBlockType(view, 'bulletList');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(6, undefined, {
      label: '•',
      listType: 'bullet',
      spread: true,
      checked: null,
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts a bullet list item to an ordered list by changing container and list item attrs', () => {
    const listItemNode = {
      type: { name: 'list_item' },
      attrs: { label: '•', listType: 'bullet', spread: true, checked: null },
    };
    const bulletListNode = {
      type: { name: 'bullet_list' },
      attrs: { spread: false },
    };
    const tr = {
      setNodeMarkup: vi.fn(() => tr),
    };
    const state: any = {
      selection: {
        $from: {
          depth: 3,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn((depth: number) => {
            if (depth === 2) return listItemNode;
            if (depth === 1) return bulletListNode;
            return { type: { name: 'doc' } };
          }),
          before: vi.fn((depth?: number) => (depth === 2 ? 6 : 2)),
        },
      },
      schema: {
        nodes: {
          ordered_list: { name: 'ordered_list' },
        },
      },
      tr,
    };
    const dispatch = vi.fn();
    const view: any = { state, dispatch, focus: vi.fn() };

    convertBlockType(view, 'orderedList');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 2, state.schema.nodes.ordered_list, {
      order: 1,
      spread: false,
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 6, undefined, {
      label: '1.',
      listType: 'ordered',
      spread: true,
      checked: null,
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts an ordered list item to a bullet list by changing container and list item attrs', () => {
    const listItemNode = {
      type: { name: 'list_item' },
      attrs: { label: '1.', listType: 'ordered', spread: true, checked: null },
    };
    const orderedListNode = {
      type: { name: 'ordered_list' },
      attrs: { order: 3, spread: false },
    };
    const tr = {
      setNodeMarkup: vi.fn(() => tr),
    };
    const state: any = {
      selection: {
        $from: {
          depth: 3,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn((depth: number) => {
            if (depth === 2) return listItemNode;
            if (depth === 1) return orderedListNode;
            return { type: { name: 'doc' } };
          }),
          before: vi.fn((depth?: number) => (depth === 2 ? 6 : 2)),
        },
      },
      schema: {
        nodes: {
          bullet_list: { name: 'bullet_list' },
        },
      },
      tr,
    };
    const dispatch = vi.fn();
    const view: any = { state, dispatch, focus: vi.fn() };

    convertBlockType(view, 'bulletList');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 2, state.schema.nodes.bullet_list, {
      spread: false,
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 6, undefined, {
      label: '•',
      listType: 'bullet',
      spread: true,
      checked: null,
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts a task list item to an ordered list by changing container type and clearing checked', () => {
    const listItemNode = {
      type: { name: 'list_item' },
      attrs: { label: '•', listType: 'bullet', spread: true, checked: false },
    };
    const bulletListNode = {
      type: { name: 'bullet_list' },
      attrs: { spread: false },
    };
    const tr = {
      setNodeMarkup: vi.fn(() => tr),
    };
    const state: any = {
      selection: {
        $from: {
          depth: 3,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn((depth: number) => {
            if (depth === 2) return listItemNode;
            if (depth === 1) return bulletListNode;
            return { type: { name: 'doc' } };
          }),
          before: vi.fn((depth?: number) => (depth === 2 ? 6 : 2)),
        },
      },
      schema: {
        nodes: {
          ordered_list: { name: 'ordered_list' },
        },
      },
      tr,
    };
    const dispatch = vi.fn();
    const view: any = { state, dispatch, focus: vi.fn() };

    convertBlockType(view, 'orderedList');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 2, state.schema.nodes.ordered_list, {
      order: 1,
      spread: false,
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 6, undefined, {
      label: '1.',
      listType: 'ordered',
      spread: true,
      checked: null,
    });
    expect(dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

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

  it('updates every selected paragraph and heading outside lists', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };
    const headingNode = {
      type: { name: 'heading' },
      attrs: { level: 2, align: 'left' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 2,
          to: 20,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 1),
            node: vi.fn(() => ({ type: { name: 'doc' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 1, { type: { name: 'doc' } });
            callback(headingNode, 10, { type: { name: 'doc' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'right');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 1, undefined, {
      align: 'right',
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 10, undefined, {
      level: 2,
      align: 'right',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('updates list item paragraphs', () => {
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
            node: vi.fn(() => ({ type: { name: 'list_item' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'list_item' } });
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

  it('updates task list item paragraphs', () => {
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
            node: vi.fn(() => ({ type: { name: 'list_item' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'list_item' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'right');

    expect(tr.setNodeMarkup).toHaveBeenCalledWith(4, undefined, {
      align: 'right',
    });
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('collapses the selection after applying a text color', () => {
    const collapsedSelection = { type: 'collapsed-selection' };
    const textColorMark = {
      create: vi.fn(() => 'text-color-mark'),
    };
    const tr: any = {
      doc: { content: { size: 30 } },
      addMark: vi.fn(() => tr),
      removeMark: vi.fn(() => tr),
      setSelection: vi.fn(() => tr),
    };
    const view: any = {
      state: {
        selection: { from: 4, to: 12 },
        schema: {
          marks: {
            textColor: textColorMark,
          },
        },
        tr,
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };
    mockTextSelectionCreate.mockReturnValue(collapsedSelection);

    setTextColor(view, '#ef4444');

    expect(textColorMark.create).toHaveBeenCalledWith({ color: '#ef4444' });
    expect(tr.addMark).toHaveBeenCalledWith(4, 12, 'text-color-mark');
    expect(mockTextSelectionCreate).toHaveBeenCalledWith(tr.doc, 12);
    expect(tr.setSelection).toHaveBeenCalledWith(collapsedSelection);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('collapses the selection after applying a background color', () => {
    const collapsedSelection = { type: 'collapsed-selection' };
    const bgColorMark = {
      create: vi.fn(() => 'bg-color-mark'),
    };
    const tr: any = {
      doc: { content: { size: 30 } },
      addMark: vi.fn(() => tr),
      removeMark: vi.fn(() => tr),
      setSelection: vi.fn(() => tr),
    };
    const view: any = {
      state: {
        selection: { from: 4, to: 12 },
        schema: {
          marks: {
            bgColor: bgColorMark,
          },
        },
        tr,
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };
    mockTextSelectionCreate.mockReturnValue(collapsedSelection);

    setBgColor(view, '#fde68a');

    expect(bgColorMark.create).toHaveBeenCalledWith({ color: '#fde68a' });
    expect(tr.addMark).toHaveBeenCalledWith(4, 12, 'bg-color-mark');
    expect(mockTextSelectionCreate).toHaveBeenCalledWith(tr.doc, 12);
    expect(tr.setSelection).toHaveBeenCalledWith(collapsedSelection);
    expect(view.dispatch).toHaveBeenCalledWith(tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('does not update table cell paragraphs', () => {
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
            node: vi.fn(() => ({ type: { name: 'table_cell' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 4, { type: { name: 'table_cell' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
    expect(view.focus).not.toHaveBeenCalled();
  });

  it('only updates alignable blocks in mixed custom-block selections', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: { align: 'left' },
    };
    const headingNode = {
      type: { name: 'heading' },
      attrs: { level: 3, align: 'left' },
    };
    const codeBlockNode = {
      type: { name: 'code_block' },
      attrs: {},
    };
    const imageNode = {
      type: { name: 'image' },
      attrs: { src: 'demo.png' },
    };

    const tr = {
      setNodeMarkup: vi.fn(),
    };

    const view: any = {
      state: {
        selection: {
          from: 2,
          to: 30,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 1),
            node: vi.fn(() => ({ type: { name: 'doc' } })),
          },
        },
        tr,
        doc: {
          nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
            callback(paragraphNode, 1, { type: { name: 'doc' } });
            callback(codeBlockNode, 8, { type: { name: 'doc' } });
            callback(imageNode, 18, { type: { name: 'doc' } });
            callback(headingNode, 22, { type: { name: 'doc' } });
          }),
        },
      },
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    setTextAlignment(view, 'center');

    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(1, 1, undefined, {
      align: 'center',
    });
    expect(tr.setNodeMarkup).toHaveBeenNthCalledWith(2, 22, undefined, {
      level: 3,
      align: 'center',
    });
    expect(tr.setNodeMarkup).toHaveBeenCalledTimes(2);
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
        tr: {
          setSelection: vi.fn().mockReturnThis(),
          setMeta: vi.fn().mockReturnThis(),
        },
        doc: {
          content: {
            size: 8,
          },
          resolve: vi.fn((pos: number) => ({ pos })),
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
      dispatch: vi.fn(),
      focus: vi.fn(),
    };

    const copied = await copySelectionToClipboard(view);

    expect(copied).toBe(true);
    expect(clipboardWrite).toHaveBeenCalledWith('Hello');
    expect(view.state.tr.setMeta).toHaveBeenCalled();
    expect(view.dispatch).toHaveBeenCalledWith(view.state.tr);
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts every selected plain text block around code blocks into headings', () => {
    const paragraphNode = {
      type: { name: 'paragraph' },
      attrs: {},
    };
    const headingNode = {
      type: { name: 'heading' },
      attrs: { level: 2 },
    };
    const codeBlockNode = {
      type: { name: 'code_block' },
      attrs: {},
    };

    const selectionByPos = new Map<number, any>();
    const docEntries = [
      { node: paragraphNode, pos: 1, parent: { type: { name: 'doc' } } },
      { node: codeBlockNode, pos: 9, parent: { type: { name: 'doc' } } },
      { node: headingNode, pos: 20, parent: { type: { name: 'doc' } } },
    ];

    const createSelection = (pos: number, parent: any) => ({
      from: pos,
      to: pos,
      empty: true,
      $from: {
        depth: 1,
        pos,
        parent,
        before: vi.fn(() => pos - 1),
        node: vi.fn((depth: number) => (depth === 1 ? parent : { type: { name: 'doc' } })),
      },
      $to: {
        depth: 1,
        pos,
        parent,
        before: vi.fn(() => pos - 1),
        node: vi.fn((depth: number) => (depth === 1 ? parent : { type: { name: 'doc' } })),
      },
    });

    selectionByPos.set(2, createSelection(2, paragraphNode));
    selectionByPos.set(21, createSelection(21, headingNode));

    const createDoc = () => {
      const doc: any = {
        content: { size: 40 },
        nodeAt: vi.fn((pos: number) => docEntries.find((entry) => entry.pos === pos)?.node ?? null),
        nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
          docEntries.forEach((entry) => callback(entry.node, entry.pos, entry.parent));
        }),
      };
      doc.eq = vi.fn((other: unknown) => other === doc);
      return doc;
    };

    const tr: any = {
      _selection: null,
      setSelection: vi.fn(function (this: any, selection: any) {
        this._selection = selection;
        return this;
      }),
      setMeta: vi.fn(function (this: any) {
        return this;
      }),
    };

    const view: any = {
      state: {
        selection: {
          from: 1,
          to: 30,
          empty: false,
          $from: {
            parent: paragraphNode,
            before: vi.fn(() => 1),
            node: vi.fn(() => ({ type: { name: 'doc' } })),
          },
        },
        schema: {
          nodes: {
            paragraph: { name: 'paragraph' },
            heading: { name: 'heading' },
          },
        },
        tr,
        doc: createDoc(),
      },
      dom: document.createElement('div'),
      dispatch: vi.fn((nextTr: any) => {
        if (nextTr?._selection?.from) {
          view.state.selection = selectionByPos.get(nextTr._selection.from) ?? view.state.selection;
        }
      }),
      focus: vi.fn(),
    };

    mockTextSelectionCreate.mockImplementation((_doc: unknown, pos: number) => ({ from: pos, to: pos }));
    mockSetBlockType.mockImplementation(() => () => {
      view.state = {
        ...view.state,
        doc: createDoc(),
      };
      return true;
    });

    convertBlockType(view, 'heading4');

    expect(mockTextSelectionCreate).toHaveBeenNthCalledWith(1, expect.anything(), 21);
    expect(mockTextSelectionCreate).toHaveBeenNthCalledWith(2, expect.anything(), 2);
    expect(mockSetBlockType).toHaveBeenCalledTimes(2);
    expect(mockSetBlockType).toHaveBeenNthCalledWith(1, view.state.schema.nodes.heading, { level: 4 });
    expect(mockSetBlockType).toHaveBeenNthCalledWith(2, view.state.schema.nodes.heading, { level: 4 });
    expect(view.focus).toHaveBeenCalled();
  });

  it('converts selected list items above code blocks into headings too', () => {
    const listParagraphNode = {
      type: { name: 'paragraph' },
      attrs: {},
    };
    const lowerParagraphNode = {
      type: { name: 'paragraph' },
      attrs: {},
    };
    const codeBlockNode = {
      type: { name: 'code_block' },
      attrs: {},
    };

    const listItemNode = {
      type: { name: 'list_item' },
      attrs: { label: '•', listType: 'bullet', checked: null },
    };

    const selectionByPos = new Map<number, any>();
    const docEntries = [
      { node: listParagraphNode, pos: 3, parent: listItemNode },
      { node: codeBlockNode, pos: 11, parent: { type: { name: 'doc' } } },
      { node: lowerParagraphNode, pos: 20, parent: { type: { name: 'doc' } } },
    ];

    const createSelection = (pos: number, parent: any, depth = 1) => ({
      from: pos,
      to: pos,
      empty: true,
      $from: {
        depth,
        pos,
        parent,
        before: vi.fn((currentDepth?: number) => {
          if (currentDepth === 2) {
            return 2;
          }

          return pos - 1;
        }),
        node: vi.fn((currentDepth: number) => {
          if (depth === 2 && currentDepth === 2) {
            return parent;
          }
          if (depth === 2 && currentDepth === 1) {
            return listItemNode;
          }
          return currentDepth === depth ? parent : { type: { name: 'doc' } };
        }),
      },
      $to: {
        depth,
        pos,
        parent,
        before: vi.fn(() => pos - 1),
        node: vi.fn((currentDepth: number) => (currentDepth === depth ? parent : { type: { name: 'doc' } })),
      },
    });

    selectionByPos.set(4, createSelection(4, listParagraphNode, 2));
    selectionByPos.set(21, createSelection(21, lowerParagraphNode));

    const createDoc = () => {
      const doc: any = {
        content: { size: 40 },
        nodeAt: vi.fn((pos: number) => docEntries.find((entry) => entry.pos === pos)?.node ?? null),
        nodesBetween: vi.fn((_from: number, _to: number, callback: (node: any, pos: number, parent: any) => void) => {
          docEntries.forEach((entry) => callback(entry.node, entry.pos, entry.parent));
        }),
      };
      doc.eq = vi.fn((other: unknown) => other === doc);
      return doc;
    };

    const tr: any = {
      _selection: null,
      setSelection: vi.fn(function (this: any, selection: any) {
        this._selection = selection;
        return this;
      }),
      setMeta: vi.fn(function (this: any) {
        return this;
      }),
    };

    const view: any = {
      state: {
        selection: {
          from: 6,
          to: 28,
          empty: false,
          $from: {
            depth: 2,
            parent: listParagraphNode,
            before: vi.fn(() => 2),
            node: vi.fn((depth: number) => {
              if (depth === 2) {
                return listParagraphNode;
              }
              if (depth === 1) {
                return listItemNode;
              }

              return { type: { name: 'doc' } };
            }),
          },
          $to: {
            depth: 1,
            parent: lowerParagraphNode,
            before: vi.fn(() => 20),
            node: vi.fn((depth: number) => {
              if (depth === 1) {
                return lowerParagraphNode;
              }

              return { type: { name: 'doc' } };
            }),
          },
        },
        schema: {
          nodes: {
            heading: { name: 'heading' },
          },
        },
        tr,
        doc: createDoc(),
      },
      dom: document.createElement('div'),
      dispatch: vi.fn((nextTr: any) => {
        if (nextTr?._selection?.from) {
          view.state.selection = selectionByPos.get(nextTr._selection.from) ?? view.state.selection;
        }
      }),
      focus: vi.fn(),
    };

    mockTextSelectionCreate.mockImplementation((_doc: unknown, pos: number) => ({ from: pos, to: pos }));
    mockLift.mockImplementation(() => true);
    mockSetBlockType.mockImplementation(() => () => {
      view.state = {
        ...view.state,
        doc: createDoc(),
      };
      return true;
    });

    convertBlockType(view, 'heading1');

    expect(mockTextSelectionCreate).toHaveBeenNthCalledWith(1, expect.anything(), 21);
    expect(mockTextSelectionCreate).toHaveBeenNthCalledWith(2, expect.anything(), 4);
    expect(mockLift).toHaveBeenCalled();
    expect(mockSetBlockType).toHaveBeenCalledTimes(2);
    expect(mockSetBlockType).toHaveBeenNthCalledWith(1, view.state.schema.nodes.heading, { level: 1 });
    expect(mockSetBlockType).toHaveBeenNthCalledWith(2, view.state.schema.nodes.heading, { level: 1 });
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
