import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertBlockType } from './commands';

const mockSetBlockType = vi.fn();
const mockWrapIn = vi.fn();
const mockLift = vi.fn();

vi.mock('@milkdown/kit/prose/commands', () => ({
  setBlockType: (...args: unknown[]) => mockSetBlockType(...args),
  wrapIn: (...args: unknown[]) => mockWrapIn(...args),
  lift: (...args: unknown[]) => mockLift(...args),
}));

function createListContextView(listType: 'bullet_list' | 'ordered_list', checked: boolean | null = null) {
  const blockquoteType = { name: 'blockquote' };
  const initialState: any = {
    selection: {
      $from: {
        depth: 3,
        before: vi.fn((depth?: number) => (depth === 2 ? 6 : 2)),
        parent: { type: { name: 'paragraph' } },
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
            return { type: { name: listType }, attrs: { spread: false } };
          }

          return { type: { name: 'doc' } };
        }),
      },
    },
    schema: {
      nodes: {
        paragraph: { name: 'paragraph' },
        blockquote: blockquoteType,
      },
    },
  };

  const unwrappedState: any = {
    ...initialState,
    selection: {
      $from: {
        depth: 1,
        before: vi.fn(() => 1),
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

  mockLift.mockImplementation(() => {
    view.state = unwrappedState;
    return true;
  });

  const applyWrap = vi.fn(() => true);
  mockWrapIn.mockReturnValue(applyWrap);

  return { applyWrap, blockquoteType, dispatch, initialState, unwrappedState, view };
}

describe('block type conversion matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['bullet list', 'bullet_list', null],
    ['ordered list', 'ordered_list', null],
    ['task list', 'bullet_list', false],
  ] as const)('converts %s to blockquote as an exclusive block type', (_label, listType, checked) => {
    const { applyWrap, blockquoteType, dispatch, initialState, unwrappedState, view } =
      createListContextView(listType, checked);

    convertBlockType(view, 'blockquote');

    expect(mockLift).toHaveBeenCalledWith(initialState, dispatch);
    expect(mockWrapIn).toHaveBeenCalledWith(blockquoteType);
    expect(applyWrap).toHaveBeenCalledWith(unwrappedState, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });

  it.each([
    ['paragraph', 'paragraph', { name: 'paragraph' }, undefined],
    ['heading1', 'heading1', { name: 'heading' }, { level: 1 }],
    ['heading6', 'heading6', { name: 'heading' }, { level: 6 }],
    ['codeBlock', 'codeBlock', { name: 'code_block' }, undefined],
  ] as const)('converts plain paragraph to %s', (_label, targetType, nodeType, attrs) => {
    const state: any = {
      selection: {
        $from: {
          depth: 1,
          parent: { type: { name: 'paragraph' } },
          node: vi.fn(() => ({ type: { name: 'doc' } })),
        },
      },
      schema: {
        nodes: {
          paragraph: { name: 'paragraph' },
          heading: { name: 'heading' },
          code_block: { name: 'code_block' },
        },
      },
    };
    const dispatch = vi.fn();
    const view: any = { state, dispatch, focus: vi.fn() };
    const applyBlockType = vi.fn(() => true);
    mockSetBlockType.mockReturnValue(applyBlockType);

    convertBlockType(view, targetType);

    expect(mockSetBlockType).toHaveBeenCalledWith(nodeType, attrs);
    expect(applyBlockType).toHaveBeenCalledWith(state, dispatch);
    expect(view.focus).toHaveBeenCalled();
  });
});
