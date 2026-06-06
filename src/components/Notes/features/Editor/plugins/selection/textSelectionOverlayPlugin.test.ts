import { describe, expect, it, vi } from 'vitest';
import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/kit/core';
import { AllSelection, NodeSelection, TextSelection } from '@milkdown/kit/prose/state';
import type { Decoration, EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import type { MilkdownPlugin } from '@milkdown/kit/ctx';
import {
  addTextSelectionOverlayDecorations,
  getNativeSelectionMetrics,
  TEXT_SELECTION_OVERLAY_CLASS,
  textSelectionOverlayPlugin,
} from './textSelectionOverlayPlugin';
import { mathPlugin } from '../math';
import { tocPlugin } from '../toc';
import { videoPlugin } from '../video';

const OVERLAY_ACTIVE_CLASS = 'editor-text-selection-overlay-active';
const POINTER_NATIVE_SELECTION_CLASS = 'editor-pointer-native-selection';

function getOverlayText(view: EditorView): string {
  return Array.from(
    view.dom.querySelectorAll(`.${TEXT_SELECTION_OVERLAY_CLASS}`)
  ).map((element) => element.textContent ?? '').join('');
}

async function createEditor(defaultValue: string, plugins: MilkdownPlugin[] = []): Promise<EditorView> {
  let editor = Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue);
    })
    .use(commonmark)
    .use(textSelectionOverlayPlugin);

  for (const plugin of plugins) {
    editor = editor.use(plugin);
  }

  await editor.create();

  return editor.ctx.get(editorViewCtx);
}

function findNodePos(view: EditorView, typeName: string): number {
  let found = -1;
  view.state.doc.descendants((node, pos) => {
    if (found < 0 && node.type.name === typeName) {
      found = pos;
      return false;
    }

    return true;
  });

  return found;
}

describe('textSelectionOverlayPlugin', () => {
  it('enables overlay styling for ordinary text selections', async () => {
    const view = await createEditor('hello');

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
  });

  it('uses native pointer routing while keeping overlay text selection styling', async () => {
    const view = await createEditor('hello');
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => view.dom,
    });

    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);

      view.dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));

      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(true);

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);
    } finally {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it.each([
    { key: 'ArrowRight', ctrlKey: true },
    { key: 'ArrowLeft', ctrlKey: true },
    { key: 'ArrowDown', ctrlKey: true },
    { key: 'ArrowUp', ctrlKey: true },
    { key: 'Home', ctrlKey: true },
    { key: 'End', ctrlKey: true },
    { key: 'PageUp', shiftKey: true },
    { key: 'PageDown', shiftKey: true },
    { key: 'ArrowRight', shiftKey: true },
    { key: 'ArrowRight', ctrlKey: true, shiftKey: true },
  ])('keeps native selection active for modified navigation keys: %o', async (eventInit) => {
    const view = await createEditor('hello world');
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => view.dom,
    });

    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
      view.dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));

      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(true);

      view.dom.dispatchEvent(
        new KeyboardEvent('keydown', {
          ...eventInit,
          bubbles: true,
          cancelable: true,
        })
      );

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(true);
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
    } finally {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it.each([
    { key: 'ArrowRight', ctrlKey: true },
    { key: 'ArrowLeft', ctrlKey: true },
    { key: 'ArrowDown', ctrlKey: true },
    { key: 'ArrowUp', ctrlKey: true },
    { key: 'Home', ctrlKey: true },
    { key: 'End', ctrlKey: true },
    { key: 'PageUp', shiftKey: true },
    { key: 'PageDown', shiftKey: true },
    { key: 'ArrowRight', ctrlKey: true, shiftKey: true },
  ])('keeps keyboard modified navigation on the overlay path: %o', async (eventInit) => {
    const view = await createEditor('hello world');

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 2)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
    expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);

    view.dom.dispatchEvent(
      new KeyboardEvent('keydown', {
        ...eventInit,
        bubbles: true,
        cancelable: true,
      })
    );

    expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);
    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
  });

  it('keeps overlay mode and clears a browser range after pointer text selection', async () => {
    const view = await createEditor('hello');
    const originalGetSelection = window.getSelection;
    const originalElementFromPoint = document.elementFromPoint;
    let selectionCleared = false;
    const removeAllRanges = vi.fn(() => {
      selectionCleared = true;
    });
    const fakeRect = { height: 19, top: 120 } as DOMRect;

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => view.dom,
    });
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        anchorOffset: 0,
        focusOffset: 4,
        isCollapsed: selectionCleared,
        rangeCount: selectionCleared ? 0 : 1,
        removeAllRanges,
        getRangeAt: () => ({
          getClientRects: () => [fakeRect],
        }),
      }),
    });

    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));
      view.dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(removeAllRanges).toHaveBeenCalledTimes(1);
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it('reads native selection rect count without materializing every rect', () => {
    const originalGetSelection = window.getSelection;
    const rectIterator = vi.fn(() => {
      throw new Error('rects should not be iterated');
    });

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        isCollapsed: false,
        rangeCount: 1,
        getRangeAt: () => ({
          getClientRects: () => ({
            length: 2048,
            [Symbol.iterator]: rectIterator,
          }),
        }),
      }),
    });

    try {
      expect(getNativeSelectionMetrics()).toEqual({
        isCollapsed: false,
        rectCount: 2048,
      });
      expect(rectIterator).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
    }
  });

  it('defers clearing the browser range until pointer selection ends', async () => {
    const view = await createEditor('hello');
    const originalGetSelection = window.getSelection;
    const originalElementFromPoint = document.elementFromPoint;
    let selectionCleared = false;
    const removeAllRanges = vi.fn(() => {
      selectionCleared = true;
    });
    const fakeRect = { height: 19, top: 120 } as DOMRect;

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        anchorOffset: 0,
        focusOffset: 4,
        isCollapsed: selectionCleared,
        rangeCount: selectionCleared ? 0 : 1,
        removeAllRanges,
        getRangeAt: () => ({
          getClientRects: () => [fakeRect],
        }),
      }),
    });
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => view.dom,
    });

    try {
      view.dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(removeAllRanges).not.toHaveBeenCalled();

      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(removeAllRanges).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it('releases native pointer routing after pointer selection completes', async () => {
    const view = await createEditor('hello');
    const originalGetSelection = window.getSelection;
    const originalElementFromPoint = document.elementFromPoint;
    let selectionCleared = false;
    const removeAllRanges = vi.fn(() => {
      selectionCleared = true;
    });
    const fakeRect = { height: 19, top: 120 } as DOMRect;

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => view.dom,
    });
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        anchorOffset: 0,
        focusOffset: 4,
        isCollapsed: selectionCleared,
        rangeCount: selectionCleared ? 0 : 1,
        removeAllRanges,
        getRangeAt: () => ({
          getClientRects: () => [fakeRect],
        }),
      }),
    });

    try {
      view.dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));

      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(true);

      view.dom.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(removeAllRanges).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it('does not switch selection rendering modes on window blur', async () => {
    const view = await createEditor('hello');
    const originalGetSelection = window.getSelection;
    const originalElementFromPoint = document.elementFromPoint;
    const removeAllRanges = vi.fn();
    const fakeRect = { height: 19, top: 120 } as DOMRect;

    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => view.dom,
    });
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        anchorOffset: 0,
        focusOffset: 4,
        isCollapsed: false,
        rangeCount: 1,
        removeAllRanges,
        getRangeAt: () => ({
          getClientRects: () => [fakeRect],
        }),
      }),
    });

    try {
      view.dom.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));

      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(true);

      window.dispatchEvent(new Event('blur'));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(true);
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(removeAllRanges).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it('keeps overlay styling and clears a stale browser range when one remains visible', async () => {
    const view = await createEditor('hello');
    const originalGetSelection = window.getSelection;
    let selectionCleared = false;
    const removeAllRanges = vi.fn(() => {
      selectionCleared = true;
    });
    const fakeRect = { height: 19, top: 120 } as DOMRect;

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        anchorOffset: 0,
        focusOffset: 4,
        isCollapsed: selectionCleared,
        rangeCount: selectionCleared ? 0 : 1,
        removeAllRanges,
        getRangeAt: () => ({
          getClientRects: () => [fakeRect],
        }),
      }),
    });

    try {
      view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 4)));

      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(removeAllRanges).toHaveBeenCalledTimes(1);
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
    }
  });

  it('keeps overlay styling for editor select-all selections', async () => {
    const view = await createEditor('hello\n\nworld');

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
  });

  it('does not draw text selection overlay on editable list gap placeholders', async () => {
    const view = await createEditor(['- one', '- \u2800', '- two'].join('\n'));

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(getOverlayText(view)).toBe('onetwo');
    expect(getOverlayText(view)).not.toContain('\u2800');
  });

  it('does not draw text selection overlay on invisible blank-line placeholders', async () => {
    const view = await createEditor(['one', '\u200B', '\u200B\u200C', 'two'].join('\n'));

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(getOverlayText(view)).toBe('onetwo');
    expect(getOverlayText(view)).not.toContain('\u200B');
    expect(getOverlayText(view)).not.toContain('\u200C');
  });

  it('does not draw text selection overlay on whitespace-only lines', async () => {
    const view = await createEditor(['one', '   ', '\t', 'two'].join('\n'));

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(getOverlayText(view)).toBe('onetwo');
  });

  it('splits text selection overlays around newline-only spans inside text nodes', () => {
    const decorations: Decoration[] = [];

    addTextSelectionOverlayDecorations(
      decorations,
      'one\n\n  \n\ttwo',
      10,
      10,
      22
    );

    expect(decorations).toHaveLength(2);
  });

  it('caps text selection overlay decorations within a single text node', () => {
    const decorations: Decoration[] = [];
    const text = Array.from({ length: 1005 }, () => 'x\u200B').join('');

    addTextSelectionOverlayDecorations(
      decorations,
      text,
      10,
      10,
      10 + text.length
    );

    expect(decorations).toHaveLength(1000);
  });

  it('splits text selection overlays around inline editor-only placeholder characters', async () => {
    const view = await createEditor('a\u200Bb\u200Cc\u2800d');

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(getOverlayText(view)).toBe('abcd');
    expect(view.dom.querySelectorAll(`.${TEXT_SELECTION_OVERLAY_CLASS}`)).toHaveLength(4);
  });

  it('caps text selection overlay decorations across selected text nodes', async () => {
    const view = await createEditor(Array.from({ length: 1005 }, (_, index) => `line ${index}`).join('\n\n'));

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.querySelectorAll(`.${TEXT_SELECTION_OVERLAY_CLASS}`)).toHaveLength(1000);
  });

  it('clears stale native browser ranges for editor select-all overlay selections', async () => {
    const view = await createEditor('hello\n\nworld');
    const originalGetSelection = window.getSelection;
    const removeAllRanges = vi.fn();
    const fakeRect = { height: 19, top: 120 } as DOMRect;

    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: () => ({
        anchorOffset: 0,
        focusOffset: 4,
        isCollapsed: false,
        rangeCount: 1,
        removeAllRanges,
        getRangeAt: () => ({
          getClientRects: () => [fakeRect],
        }),
      }),
    });

    try {
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);

      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      expect(removeAllRanges).toHaveBeenCalledTimes(1);
      expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(true);
      expect(view.dom.classList.contains(POINTER_NATIVE_SELECTION_CLASS)).toBe(false);
    } finally {
      Object.defineProperty(window, 'getSelection', {
        configurable: true,
        value: originalGetSelection,
      });
    }
  });

  it('adds block selection styling to formulas covered by editor select-all', async () => {
    const view = await createEditor('before\n\n$$\nx^2\n$$\n\nafter', mathPlugin);

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(
      view.dom.querySelector('[data-type="math-block"]')?.classList.contains('editor-block-selected')
    ).toBe(true);
    expect(
      view.dom.querySelector('[data-type="math-block"]')?.classList.contains('md-focus')
    ).toBe(true);
    expect(
      view.dom.querySelector('[data-type="math-block"]')?.classList.contains('editor-atomic-selected')
    ).toBe(true);
  });

  it('adds block selection styling to tables covered by editor select-all', async () => {
    const view = await createEditor('| A | B |\n| --- | --- |\n| 1 | 2 |', [gfm]);

    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.querySelector('table')?.classList.contains('editor-block-selected')).toBe(
      true
    );
    expect(view.dom.querySelector('table')?.classList.contains('md-focus')).toBe(
      true
    );
    expect(view.dom.querySelector('table')?.classList.contains('editor-atomic-selected')).toBe(
      true
    );
  });

  it.each([
    {
      typeName: 'video',
      plugins: videoPlugin,
      attrs: { src: '', title: '', width: 560, height: 315 },
      selector: '[data-type="video"]',
    },
    {
      typeName: 'toc',
      plugins: tocPlugin,
      attrs: { maxLevel: 6 },
      selector: '[data-type="toc"]',
    },
  ])('adds block selection styling to $typeName blocks covered by editor select-all', async ({ typeName, plugins, attrs, selector }) => {
    const view = await createEditor('placeholder', plugins);
    const nodeType = view.state.schema.nodes[typeName];
    expect(nodeType).toBeDefined();

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, nodeType.create(attrs)));
    view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));

    expect(view.dom.querySelector(selector)?.classList.contains('editor-block-selected')).toBe(
      true
    );
    expect(view.dom.querySelector(selector)?.classList.contains('md-focus')).toBe(
      true
    );
    expect(view.dom.querySelector(selector)?.classList.contains('editor-atomic-selected')).toBe(
      true
    );
  });

  it('does not hide native selection styling for node selections', async () => {
    const view = await createEditor('hello\n\n---\n\nworld');
    const hrPos = findNodePos(view, 'hr');

    expect(hrPos).toBeGreaterThanOrEqual(0);

    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, hrPos)));

    expect(view.dom.classList.contains(OVERLAY_ACTIVE_CLASS)).toBe(false);
  });
});
