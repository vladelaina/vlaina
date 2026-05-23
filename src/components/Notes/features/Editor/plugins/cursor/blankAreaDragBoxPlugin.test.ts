import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { Editor, defaultValueCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { describe, expect, it, vi } from 'vitest';
import { blankAreaDragBoxPlugin, shouldClearBlockSelectionForTransaction } from './blankAreaDragBoxPlugin';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { dispatchBlockSelectionAction, getBlockSelectionPluginState } from './blockSelectionPluginState';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';

function createMouseEvent(type: string, init: MouseEventInit = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...init,
  });
}

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

function simulateDomEvent(view: any, type: string, event: Event) {
  let handled = false;
  view.someProp('handleDOMEvents', (handleDOMEvents: any) => {
    handled = handleDOMEvents[type]?.(view, event) || handled;
  });
  return handled;
}

function mockTrailingPlainClickGeometry(view: any, target: HTMLElement) {
  vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 5, inside: 1 });
  vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    right: 800,
    bottom: 400,
    width: 800,
    height: 400,
    x: 0,
    y: 0,
    toJSON: () => undefined,
  } as DOMRect);
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    left: 40,
    top: 20,
    right: 760,
    bottom: 44,
    width: 720,
    height: 24,
    x: 40,
    y: 20,
    toJSON: () => undefined,
  } as DOMRect);

  const rangeRects = [{
    left: 72,
    top: 22,
    right: 112,
    bottom: 42,
    width: 40,
    height: 20,
    x: 72,
    y: 22,
    toJSON: () => undefined,
  }] as DOMRect[];
  vi.spyOn(document, 'createRange').mockImplementation(() => ({
    selectNodeContents: vi.fn(),
    getClientRects: vi.fn().mockReturnValue(rangeRects),
    detach: vi.fn(),
  }) as any);
}

function startTrailingPlainClick(view: any, target: HTMLElement) {
  const mouseDown = createMouseEvent('mousedown', {
    clientX: 220,
    clientY: 32,
  });
  Object.defineProperty(mouseDown, 'target', {
    configurable: true,
    value: target,
  });
  return simulateDomEvent(view, 'mousedown', mouseDown);
}

function finishTrailingPlainClick() {
  window.dispatchEvent(createMouseEvent('mouseup', {
    clientX: 220,
    clientY: 32,
  }));
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
  it('copies and cuts selected blocks directly from keyboard shortcuts', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { editor, view } = await createBlockSelectionEditor('Alpha\n\nBeta');

    try {
      const copy = simulateKeydown(view, 'c');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(copy.handled).toBe(true);
      expect(copy.event.defaultPrevented).toBe(true);
      expect(writeText).toHaveBeenCalledWith('Alpha');
      expect(view.state.doc.textContent).toBe('AlphaBeta');

      const cut = simulateKeydown(view, 'x');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(cut.handled).toBe(true);
      expect(cut.event.defaultPrevented).toBe(true);
      expect(writeText).toHaveBeenLastCalledWith('Alpha');
      expect(view.state.doc.textContent).toBe('Beta');
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

describe('blankAreaDragBoxPlugin trailing plain clicks', () => {
  it('keeps the caret debug copy button hidden unless explicitly enabled', async () => {
    localStorage.removeItem('vlaina_debug_caret_click');
    const first = await createBlockSelectionEditor('- Alpha');

    try {
      expect(document.querySelector('[data-notes-caret-debug-copy="true"]')).toBeNull();
    } finally {
      await first.editor.destroy();
    }

    localStorage.setItem('vlaina_debug_caret_click', '1');
    const second = await createBlockSelectionEditor('- Alpha');

    try {
      expect(document.querySelector('[data-notes-caret-debug-copy="true"]')).toBeInstanceOf(HTMLButtonElement);
    } finally {
      await second.editor.destroy();
      localStorage.removeItem('vlaina_debug_caret_click');
    }

    expect(document.querySelector('[data-notes-caret-debug-copy="true"]')).toBeNull();
  });

  it('does not override a native pointer selection that already moved during the click', async () => {
    const { editor, view } = await createBlockSelectionEditor('- Alpha\n- Beta');

    try {
      const firstParagraph = view.dom.querySelector('li p');
      expect(firstParagraph).toBeInstanceOf(HTMLElement);

      mockTrailingPlainClickGeometry(view, firstParagraph as HTMLElement);

      const originalSelection = view.state.selection.from;
      const handled = startTrailingPlainClick(view, firstParagraph as HTMLElement);
      expect(handled).toBe(false);

      const nativeSelection = TextSelection.create(view.state.doc, 5);
      view.dispatch(view.state.tr.setSelection(nativeSelection).setMeta('pointer', true));
      expect(view.state.selection.from).not.toBe(originalSelection);

      finishTrailingPlainClick();

      expect(view.state.selection.from).toBe(5);
    } finally {
      vi.restoreAllMocks();
      await editor.destroy();
    }
  });

  it('does not override a native pointer click when the selection position stays the same', async () => {
    const { editor, view } = await createBlockSelectionEditor('- Alpha\n- Beta');

    try {
      const firstParagraph = view.dom.querySelector('li p');
      expect(firstParagraph).toBeInstanceOf(HTMLElement);

      mockTrailingPlainClickGeometry(view, firstParagraph as HTMLElement);

      const originalSelection = view.state.selection.from;
      const handled = startTrailingPlainClick(view, firstParagraph as HTMLElement);
      expect(handled).toBe(false);

      view.dispatch(
        view.state.tr
          .setSelection(TextSelection.create(view.state.doc, originalSelection))
          .setMeta('pointer', true)
      );
      expect(view.state.selection.from).toBe(originalSelection);

      finishTrailingPlainClick();

      expect(view.state.selection.from).toBe(originalSelection);
    } finally {
      vi.restoreAllMocks();
      await editor.destroy();
    }
  });
});
