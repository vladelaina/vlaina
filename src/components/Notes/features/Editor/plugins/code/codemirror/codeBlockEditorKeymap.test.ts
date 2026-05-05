import { describe, expect, it, vi } from 'vitest';

const blockSelectionMocks = vi.hoisted(() => ({
  deleteSelectedBlocks: vi.fn(() => true),
  getBlockSelectionPluginState: vi.fn(() => ({ selectedBlocks: [] })),
  blankAreaDragBoxPluginKey: { key: 'blank-area-drag-box' },
  clearBlocksAction: { type: 'clear-blocks' },
}));

vi.mock('@milkdown/kit/prose/state', () => ({
  TextSelection: {
    near: vi.fn(() => 'text-selection'),
  },
  AllSelection: {
    create: vi.fn(() => 'all-selection'),
  },
}));

vi.mock('../../cursor/blockSelectionCommands', () => ({
  deleteSelectedBlocks: blockSelectionMocks.deleteSelectedBlocks,
}));

vi.mock('../../cursor/blockSelectionPluginState', () => ({
  blankAreaDragBoxPluginKey: blockSelectionMocks.blankAreaDragBoxPluginKey,
  CLEAR_BLOCKS_ACTION: blockSelectionMocks.clearBlocksAction,
  getBlockSelectionPluginState: blockSelectionMocks.getBlockSelectionPluginState,
}));

import { createCodeBlockEditorKeymap } from './codeBlockEditorKeymap';

describe('createCodeBlockEditorKeymap', () => {
  it('deletes the outer block selection before CodeMirror handles Backspace', () => {
    const selectedBlocks = [{ from: 4, to: 10 }];
    blockSelectionMocks.getBlockSelectionPluginState.mockReturnValueOnce({ selectedBlocks } as never);
    const focus = vi.fn();
    const view = {
      state: { id: 'state' },
      dom: document.createElement('div'),
      focus,
    };

    const keymaps = createCodeBlockEditorKeymap({
      getCodeMirror: () => ({}) as never,
      view: view as never,
      getNode: () => ({}) as never,
      getPos: () => 0,
    });

    const backspace = keymaps.find((binding) => binding.key === 'Backspace');

    expect(backspace?.run?.({} as never)).toBe(true);
    expect(blockSelectionMocks.deleteSelectedBlocks).toHaveBeenCalledWith(
      view,
      selectedBlocks,
      expect.any(Function)
    );
    expect(focus).not.toHaveBeenCalled();
  });

  it('selects all content inside CodeMirror on Mod-a', () => {
    const dispatch = vi.fn();
    const focus = vi.fn();
    const cm = {
      dispatch,
      focus,
      state: {
        doc: {
          length: 12,
        },
        selection: {
          main: {
            from: 2,
            to: 4,
          },
        },
      },
    };

    const keymaps = createCodeBlockEditorKeymap({
      getCodeMirror: () => cm as never,
      view: {
        state: {
          selection: {
            from: 2,
            to: 2,
            empty: true,
            constructor: { name: 'TextSelection' },
          },
        },
      } as never,
      getNode: () => ({}) as never,
      getPos: () => 0,
    });

    const selectAll = keymaps.find((binding) => binding.key === 'Mod-a');

    expect(selectAll?.run?.({} as never)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith({
      selection: {
        anchor: 0,
        head: 12,
      },
    });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('returns false for Mod-a when CodeMirror is unavailable', () => {
    const keymaps = createCodeBlockEditorKeymap({
      getCodeMirror: () => undefined,
      view: {
        state: {
          selection: {
            from: 2,
            to: 2,
            empty: true,
            constructor: { name: 'TextSelection' },
          },
        },
      } as never,
      getNode: () => ({}) as never,
      getPos: () => 0,
    });

    const selectAll = keymaps.find((binding) => binding.key === 'Mod-a');

    expect(selectAll?.run?.({} as never)).toBe(false);
  });

  it('escalates to editor-wide selection on the second Mod-a', () => {
    const cmFocus = vi.fn();
    const editorDispatch = vi.fn();
    const editorFocus = vi.fn();
    const transaction = {};
    const setSelection = vi.fn(() => transaction);
    const cm = {
      dispatch: vi.fn(),
      focus: cmFocus,
      state: {
        doc: {
          length: 12,
        },
        selection: {
          main: {
            from: 0,
            to: 12,
          },
        },
      },
    };

    const keymaps = createCodeBlockEditorKeymap({
      getCodeMirror: () => cm as never,
      view: {
        state: {
          selection: {
            from: 2,
            to: 2,
            empty: true,
            constructor: { name: 'TextSelection' },
          },
          doc: {},
          tr: {
            setSelection,
          },
        },
        dispatch: editorDispatch,
        focus: editorFocus,
      } as never,
      getNode: () => ({}) as never,
      getPos: () => 0,
    });

    const selectAll = keymaps.find((binding) => binding.key === 'Mod-a');

    expect(selectAll?.run?.({} as never)).toBe(true);
    expect(setSelection).toHaveBeenCalledTimes(1);
    expect(editorDispatch).toHaveBeenCalledWith(transaction);
    expect(editorFocus).toHaveBeenCalledTimes(1);
    expect(cm.dispatch).not.toHaveBeenCalled();
    expect(cmFocus).not.toHaveBeenCalled();
  });
});
