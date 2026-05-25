import { NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import { Editor, defaultValueCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { describe, expect, it, vi } from 'vitest';
import { blankAreaDragBoxPlugin, shouldClearBlockSelectionForTransaction } from './blankAreaDragBoxPlugin';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { dispatchBlockSelectionAction, getBlockSelectionPluginState } from './blockSelectionPluginState';
import { notesRemarkStringifyOptions } from '../../config/stringifyOptions';
import { listTabIndentPlugin } from '../task-list';

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

function typeText(view: any, input: string) {
  for (const text of input) {
    const { from, to } = view.state.selection;
    let handled = false;

    view.someProp('handleTextInput', (handleTextInput: any) => {
      handled = handleTextInput(view, from, to, text) || handled;
    });

    if (!handled) view.dispatch(view.state.tr.insertText(text, from, to));
  }
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

function findNodePosition(view: any, typeName: string, predicate: (node: any) => boolean = () => true): number {
  let found: number | null = null;
  view.state.doc.descendants((node: any, pos: number) => {
    if (found !== null) return false;
    if (node.type.name === typeName && predicate(node)) {
      found = pos;
      return false;
    }
    return true;
  });
  if (found === null) {
    throw new Error(`Expected ${typeName} node`);
  }
  return found;
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

async function createListGapSelectionEditor() {
  const editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '');
    })
    .use(commonmark)
    .use(gfm)
    .use(blankAreaDragBoxPlugin)
    .use(listTabIndentPlugin);

  await editor.create();
  const view = editor.ctx.get(editorViewCtx);
  const { schema } = view.state;
  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, [
    schema.nodes.ordered_list.create(null, [
      schema.nodes.list_item.create({ label: '1.', listType: 'ordered' }, [
        schema.nodes.paragraph.create(null, schema.text('1')),
      ]),
    ]),
    schema.nodes.bullet_list.create(null, [
      schema.nodes.list_item.create({ label: '•', listType: 'bullet' }, [
        schema.nodes.paragraph.create(null, schema.text('\u2800')),
      ]),
    ]),
    schema.nodes.ordered_list.create({ order: 3 }, [
      schema.nodes.list_item.create({ label: '3.', listType: 'ordered' }, [
        schema.nodes.paragraph.create(null, schema.text('3')),
      ]),
    ]),
  ]));
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

describe('blankAreaDragBoxPlugin list gap selection state', () => {
  it('clears a selected list gap block when typing converts the gap into a paragraph', async () => {
    const { editor, view } = await createListGapSelectionEditor();

    try {
      const blocks = collectSelectableBlockRanges(view.state.doc);
      dispatchBlockSelectionAction(view, { type: 'set-blocks', blocks: [blocks[1]] });
      expect(getBlockSelectionPluginState(view.state).selectedBlocks).toHaveLength(1);

      let placeholderEnd: number | null = null;
      view.state.doc.descendants((node, pos) => {
        if (placeholderEnd !== null || !node.isText || node.text !== '\u2800') return true;
        placeholderEnd = pos + node.nodeSize;
        return false;
      });
      expect(placeholderEnd).not.toBeNull();
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, placeholderEnd!)));
      typeText(view, '2');

      expect(view.state.doc.child(1).type.name).toBe('paragraph');
      expect(view.state.doc.child(1).textContent).toBe('2');
      expect(getBlockSelectionPluginState(view.state).selectedBlocks).toHaveLength(0);
    } finally {
      await editor.destroy();
    }
  });
});

describe('blankAreaDragBoxPlugin trailing plain clicks', () => {
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

  it('places the caret at the start of a list gap placeholder paragraph on pointer down', async () => {
    const { editor, view } = await createBlockSelectionEditor(['- Alpha', '- \u2800', '- Beta'].join('\n'));

    try {
      const placeholderParagraph = Array.from(view.dom.querySelectorAll('li p'))
        .find((paragraph) => paragraph.textContent === '\u2800');
      expect(placeholderParagraph).toBeInstanceOf(HTMLElement);

      const paragraphStart = findNodePosition(
        view,
        'paragraph',
        (node) => node.textContent === '\u2800'
      );
      vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: paragraphStart + 2, inside: paragraphStart });

      const mouseDown = createMouseEvent('mousedown', {
        clientX: 120,
        clientY: 80,
      });
      Object.defineProperty(mouseDown, 'target', {
        configurable: true,
        value: placeholderParagraph,
      });

      const handled = simulateDomEvent(view, 'mousedown', mouseDown);

      expect(handled).toBe(true);
      expect(mouseDown.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(paragraphStart + 1);
      expect(view.state.selection.$from.parentOffset).toBe(0);
    } finally {
      vi.restoreAllMocks();
      await editor.destroy();
    }
  });

  it('places the caret at the start of a list gap placeholder when the list container is the event target', async () => {
    const { editor, view } = await createBlockSelectionEditor(['- Alpha', '- \u2800', '- Beta'].join('\n'));

    try {
      const list = view.dom.querySelector('ul');
      expect(list).toBeInstanceOf(HTMLElement);

      const paragraphStart = findNodePosition(
        view,
        'paragraph',
        (node) => node.textContent === '\u2800'
      );
      vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: paragraphStart - 1, inside: 1 });

      const mouseDown = createMouseEvent('mousedown', {
        clientX: 398,
        clientY: 520,
      });
      Object.defineProperty(mouseDown, 'target', {
        configurable: true,
        value: list,
      });

      const handled = simulateDomEvent(view, 'mousedown', mouseDown);

      expect(handled).toBe(true);
      expect(mouseDown.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(paragraphStart + 1);
      expect(view.state.selection.$from.parentOffset).toBe(0);
    } finally {
      vi.restoreAllMocks();
      await editor.destroy();
    }
  });

  it('places the caret at the start of a list gap placeholder when coordinates resolve to the paragraph boundary', async () => {
    const { editor, view } = await createBlockSelectionEditor(['- Alpha', '- \u2800', '- Beta'].join('\n'));

    try {
      const list = view.dom.querySelector('ul');
      expect(list).toBeInstanceOf(HTMLElement);

      const paragraphStart = findNodePosition(
        view,
        'paragraph',
        (node) => node.textContent === '\u2800'
      );
      vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: paragraphStart, inside: 1 });

      const mouseDown = createMouseEvent('mousedown', {
        clientX: 385,
        clientY: 544,
      });
      Object.defineProperty(mouseDown, 'target', {
        configurable: true,
        value: list,
      });

      const handled = simulateDomEvent(view, 'mousedown', mouseDown);

      expect(handled).toBe(true);
      expect(mouseDown.defaultPrevented).toBe(true);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.from).toBe(paragraphStart + 1);
      expect(view.state.selection.$from.parentOffset).toBe(0);
    } finally {
      vi.restoreAllMocks();
      await editor.destroy();
    }
  });

  it('places the caret in a tail blank line when clicking below the last ordered list item', async () => {
    const { editor, view } = await createBlockSelectionEditor('1. 1');

    try {
      const list = view.dom.querySelector('ol');
      const item = view.dom.querySelector('li');
      const paragraph = view.dom.querySelector('li p');
      expect(list).toBeInstanceOf(HTMLElement);
      expect(item).toBeInstanceOf(HTMLElement);
      expect(paragraph).toBeInstanceOf(HTMLElement);

      vi.spyOn(view, 'posAtCoords').mockReturnValue({ pos: 5, inside: 1 });
      vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 180,
        width: 800,
        height: 180,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      } as DOMRect);
      vi.spyOn(list as HTMLElement, 'getBoundingClientRect').mockReturnValue({
        left: 40,
        top: 20,
        right: 760,
        bottom: 100,
        width: 720,
        height: 80,
        x: 40,
        y: 20,
        toJSON: () => undefined,
      } as DOMRect);
      vi.spyOn(item as HTMLElement, 'getBoundingClientRect').mockReturnValue({
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
      vi.spyOn(paragraph as HTMLElement, 'getBoundingClientRect').mockReturnValue({
        left: 72,
        top: 20,
        right: 760,
        bottom: 44,
        width: 688,
        height: 24,
        x: 72,
        y: 20,
        toJSON: () => undefined,
      } as DOMRect);
      vi.spyOn(document, 'createRange').mockImplementation(() => ({
        selectNodeContents: vi.fn(),
        getClientRects: vi.fn().mockReturnValue([{
          left: 72,
          top: 22,
          right: 82,
          bottom: 42,
          width: 10,
          height: 20,
          x: 72,
          y: 22,
          toJSON: () => undefined,
        }] as DOMRect[]),
        detach: vi.fn(),
      }) as any);

      const mouseDown = createMouseEvent('mousedown', {
        clientX: 120,
        clientY: 76,
      });
      Object.defineProperty(mouseDown, 'target', {
        configurable: true,
        value: list,
      });

      const handled = simulateDomEvent(view, 'mousedown', mouseDown);

      expect(handled).toBe(true);
      expect(mouseDown.defaultPrevented).toBe(true);
      expect(view.state.doc.lastChild?.type.name).toBe('paragraph');
      expect(view.state.doc.lastChild?.content.size).toBe(0);
      expect(view.state.selection).toBeInstanceOf(TextSelection);
      expect(view.state.selection.$from.parent.type.name).toBe('paragraph');
      expect(view.state.selection.$from.parentOffset).toBe(0);
      expect(view.state.selection.$from.parent.textContent).toBe('');
    } finally {
      vi.restoreAllMocks();
      await editor.destroy();
    }
  });
});
