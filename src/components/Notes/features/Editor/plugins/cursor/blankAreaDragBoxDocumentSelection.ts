import {
  NodeSelection,
  Selection,
  TextSelection,
  type EditorState,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { type BlockRange } from './blockSelectionUtils';
import { deleteSelectedBlocks as deleteSelectedBlocksCommand } from './blockSelectionCommands';
import {
  blankAreaDragBoxPluginKey,
  CLEAR_BLOCKS_ACTION,
  getBlockSelectionPluginState,
} from './blockSelectionPluginState';
import { isIgnoredBlankAreaDragBoxTarget } from './blankAreaDragTargets';
import { isTextEditingElement } from './blockSelectionInputHandlers';

export const MAX_DOCUMENT_BLOCK_SELECTION_PASTE_CHARS = 1024 * 1024;

export function shouldHandleDocumentBlockSelectionEvent(view: EditorView, event: Event): boolean {
  if (getBlockSelectionPluginState(view.state).selectedBlocks.length === 0) return false;

  const target = event.target;
  const isTargetInsideEditor = target instanceof Node && view.dom.contains(target);
  const activeElement = view.dom.ownerDocument.activeElement;
  if (activeElement instanceof HTMLElement && view.dom.contains(activeElement)) {
    if (activeElement === view.dom) return !isTargetInsideEditor;
    if (isTextEditingElement(activeElement, view.dom)) return false;
    return true;
  }

  if (isTargetInsideEditor) {
    const targetElement = target instanceof HTMLElement ? target : target.parentElement;
    if (!targetElement || targetElement === view.dom) return false;
    return !isTextEditingElement(targetElement, view.dom);
  }

  if (
    activeElement instanceof HTMLElement
    && activeElement !== view.dom.ownerDocument.body
    && activeElement !== view.dom.ownerDocument.documentElement
    && activeElement !== view.dom
  ) {
    return false;
  }

  return true;
}

function createTextSelectionNearDocumentPosition(
  doc: EditorState['doc'],
  pos: number,
  bias: -1 | 1 = -1,
): TextSelection | null {
  let before: TextSelection | null = null;
  let after: TextSelection | null = null;

  doc.descendants((node, nodePos) => {
    if (!node.isTextblock || !node.inlineContent) return true;

    const start = nodePos + 1;
    const end = start + node.content.size;
    if (nodePos <= pos) {
      try {
        before = TextSelection.create(doc, end);
      } catch {
        before = null;
      }
    }
    if (after === null && nodePos >= pos) {
      try {
        after = TextSelection.create(doc, start);
      } catch {
        after = null;
      }
    }
    return true;
  });

  return bias < 0 ? before ?? after : after ?? before;
}

export function collapseNativeNodeSelectionForExternalMouseDown(view: EditorView, event: MouseEvent): boolean {
  if (!(view.state.selection instanceof NodeSelection)) return false;
  const target = event.target;
  if (target instanceof Node && view.dom.contains(target)) return false;
  if (isIgnoredBlankAreaDragBoxTarget(target)) return false;

  const currentSelection = view.state.selection;
  const nextSelection =
    createTextSelectionNearDocumentPosition(view.state.doc, currentSelection.from, -1) ??
    Selection.near(view.state.doc.resolve(Math.max(0, Math.min(currentSelection.from, view.state.doc.content.size))), -1);
  if (nextSelection.eq(currentSelection)) return false;

  view.dispatch(
    view.state.tr
      .setSelection(nextSelection)
      .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION)
  );
  return true;
}

export function deleteSelectedBlocks(view: EditorView, blocks: readonly BlockRange[]): boolean {
  return deleteSelectedBlocksCommand(
    view,
    blocks,
    (tr) => tr.setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION),
  );
}

export function handleDocumentBlockSelectionPaste(view: EditorView, event: ClipboardEvent): boolean {
  const capturedSelectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  let handled = false;
  view.someProp('handleDOMEvents', (handleDOMEvents: { paste?: (view: EditorView, event: ClipboardEvent) => boolean }) => {
    if (handleDOMEvents.paste?.(view, event)) {
      handled = true;
      return true;
    }
    return undefined;
  });
  if (handled) return true;

  view.someProp('handlePaste', (handlePaste: (view: EditorView, event: ClipboardEvent, slice: null) => boolean) => {
    if (handlePaste(view, event, null)) {
      handled = true;
      return true;
    }
    return undefined;
  });
  if (handled) return true;

  const rawText = event.clipboardData?.getData('text/plain') ?? '';
  if (!rawText) return false;
  if (rawText.length > MAX_DOCUMENT_BLOCK_SELECTION_PASTE_CHARS) {
    event.preventDefault();
    return true;
  }
  const text = rawText.replace(/\r\n?/g, '\n');

  if (getBlockSelectionPluginState(view.state).selectedBlocks.length > 0) {
    if (!deleteSelectedBlocks(view, capturedSelectedBlocks)) return false;
  }
  view.dispatch(view.state.tr.insertText(text).scrollIntoView());
  view.focus();
  event.preventDefault();
  return true;
}
