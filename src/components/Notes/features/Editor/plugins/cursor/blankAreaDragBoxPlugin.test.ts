import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { Editor, defaultValueCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { describe, expect, it, vi } from 'vitest';
import { blankAreaDragBoxPlugin, shouldClearBlockSelectionForTransaction } from './blankAreaDragBoxPlugin';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { dispatchBlockSelectionAction, getBlockSelectionPluginState } from './blockSelectionPluginState';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';

function simulateKeydown(view: any, key: string, init: KeyboardEventInit = {}): { handled: boolean; event: KeyboardEvent } {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  });

  let handled = false;
  view.someProp('handleKeyDown', (handleKeyDown: any) => {
    handled = handleKeyDown(view, event) || handled;
  });

  return { handled, event };
}

function simulateClipboardEvent(view: any, type: 'copy' | 'cut') {
  const clipboardData = {
    setData: vi.fn(),
  };
  const event = {
    clipboardData,
    preventDefault: vi.fn(),
  };

  let handled = false;
  view.someProp('handleDOMEvents', (handleDOMEvents: any) => {
    handled = handleDOMEvents[type]?.(view, event) || handled;
  });

  return { handled, event, clipboardData };
}

async function createBlockSelectionEditor(markdown: string) {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, markdown);
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        ...notesRemarkStringifyOptions,
      }));
    })
    .use(commonmark)
    .use(gfm)
    .use(blankAreaDragBoxPlugin);

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const [firstBlock] = collectSelectableBlockRanges(view.state.doc);
  if (!firstBlock) {
    throw new Error('Expected at least one selectable block');
  }
  dispatchBlockSelectionAction(view, { type: 'set-blocks', blocks: [firstBlock] });

  return { editor, view };
}

describe('shouldClearBlockSelectionForTransaction', () => {
  it('clears block selection when the editor moves to a text selection', () => {
    const selection = Object.create(TextSelection.prototype);

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection, selectionSet: true } as never,
        { selectedBlocks: [{ from: 1, to: 5 }] }
      )
    ).toBe(true);
  });

  it('does not clear block selection for node selections or unrelated transactions', () => {
    const nodeSelection = Object.create(NodeSelection.prototype);
    const pluginState = { selectedBlocks: [{ from: 1, to: 5 }] };

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection: nodeSelection, selectionSet: true } as never,
        pluginState
      )
    ).toBe(false);

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection: Object.create(TextSelection.prototype), selectionSet: false } as never,
        pluginState
      )
    ).toBe(false);

    expect(
      shouldClearBlockSelectionForTransaction(
        { selection: Object.create(TextSelection.prototype), selectionSet: true } as never,
        { selectedBlocks: [] }
      )
    ).toBe(false);
  });
});

describe('blankAreaDragBoxPlugin clipboard shortcuts', () => {
  it('lets Ctrl+C and Ctrl+X reach native clipboard events while blocks are selected', async () => {
    const { editor, view } = await createBlockSelectionEditor('Alpha\n\nBeta');

    try {
      const copy = simulateKeydown(view, 'c');
      expect(copy.handled).toBe(false);
      expect(copy.event.defaultPrevented).toBe(false);

      const cut = simulateKeydown(view, 'x');
      expect(cut.handled).toBe(false);
      expect(cut.event.defaultPrevented).toBe(false);
      expect(view.state.doc.textContent).toBe('AlphaBeta');
    } finally {
      await editor.destroy();
    }
  });

  it('copies selected blocks during the native copy event', async () => {
    const { editor, view } = await createBlockSelectionEditor('Alpha\n\nBeta');

    try {
      const { handled, event, clipboardData } = simulateClipboardEvent(view, 'copy');

      expect(handled).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'Alpha');
      expect(getBlockSelectionPluginState(view.state).selectedBlocks).toHaveLength(1);
    } finally {
      await editor.destroy();
    }
  });

  it('cuts selected blocks during the native cut event', async () => {
    const { editor, view } = await createBlockSelectionEditor('Alpha\n\nBeta');

    try {
      const { handled, event, clipboardData } = simulateClipboardEvent(view, 'cut');

      expect(handled).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'Alpha');
      expect(view.state.doc.textContent).toBe('Beta');
      expect(getBlockSelectionPluginState(view.state).selectedBlocks).toHaveLength(0);
    } finally {
      await editor.destroy();
    }
  });
});
