import { beforeEach, describe, expect, it, vi } from 'vitest';
import { copySelectionToClipboard, convertBlockType, setTextAlignment } from './commands';

const mockSetBlockType = vi.fn();
const mockWrapIn = vi.fn();
const mockLift = vi.fn();

vi.mock('@milkdown/kit/prose/commands', () => ({
  setBlockType: (...args: unknown[]) => mockSetBlockType(...args),
  wrapIn: (...args: unknown[]) => mockWrapIn(...args),
  lift: (...args: unknown[]) => mockLift(...args),
}));

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
