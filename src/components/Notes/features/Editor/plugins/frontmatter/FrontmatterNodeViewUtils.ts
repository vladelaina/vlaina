import type { Node } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { EditorView as CodeMirror, KeyBinding } from '@codemirror/view';
import { keymap as codeMirrorKeymap } from '@codemirror/view';
import {
  createCodeBlockEditorClipboardHandlers,
  createCodeBlockEditorKeymap,
  mapDocumentOffsetToCodeBlockEditorOffset,
} from '../code/codemirror';
import { getEditorFindState } from '../find/editorFindCommands';
import {
  buildCodeMirrorFindHighlightRanges,
  syncCodeMirrorFindHighlights,
} from '../find/editorFindCodeMirrorHighlights';
import { deleteSelectedFrontmatterBlocks } from './frontmatterBlockSelection';

export function getFrontmatterOwnerWindow(
  dom: HTMLElement,
  editorDOM: HTMLElement,
  view: EditorView,
): Window | null {
  const ownerDocument = (
    dom.ownerDocument ??
    editorDOM.ownerDocument ??
    (view.root instanceof Document ? view.root : view.root.ownerDocument) ??
    null
  );

  return ownerDocument?.defaultView ?? null;
}

export function scheduleFrontmatterMeasure({
  cm,
  dom,
  editorDOM,
  pendingMeasureFrame,
  setPendingMeasureFrame,
  view,
}: {
  cm: CodeMirror;
  dom: HTMLElement;
  editorDOM: HTMLElement;
  pendingMeasureFrame: number | null;
  setPendingMeasureFrame: (frame: number | null) => void;
  view: EditorView;
}): void {
  const window = getFrontmatterOwnerWindow(dom, editorDOM, view);
  if (!window) {
    cm.requestMeasure();
    return;
  }

  if (pendingMeasureFrame !== null) {
    window.cancelAnimationFrame(pendingMeasureFrame);
  }

  setPendingMeasureFrame(window.requestAnimationFrame(() => {
    setPendingMeasureFrame(null);
    cm.requestMeasure();
  }));
}

export function createFrontmatterCodeMirrorKeymap({
  getCodeMirror,
  getNode,
  getPos,
  view,
}: {
  getCodeMirror: () => CodeMirror;
  getNode: () => Node;
  getPos: () => number | undefined;
  view: EditorView;
}): ReturnType<typeof codeMirrorKeymap.of> {
  const bindings: KeyBinding[] = [
    {
      key: 'Backspace',
      run: () => deleteSelectedFrontmatterBlocks(view, getPos(), getNode().nodeSize),
    },
    {
      key: 'Delete',
      run: () => deleteSelectedFrontmatterBlocks(view, getPos(), getNode().nodeSize),
    },
    ...createCodeBlockEditorKeymap({
      getCodeMirror,
      view,
      getNode,
      getPos,
    }),
  ];

  return codeMirrorKeymap.of(bindings);
}

export function createFrontmatterClipboardHandlers({
  getNode,
  getPos,
  view,
}: {
  getNode: () => Node;
  getPos: () => number | undefined;
  view: EditorView;
}) {
  return createCodeBlockEditorClipboardHandlers({
    view,
    getNode,
    getPos,
  });
}

export function buildFrontmatterFindHighlightRanges(
  view: EditorView,
  node: Node,
  nodePos: number | undefined,
) {
  if (nodePos === undefined) {
    return [];
  }

  const state = getEditorFindState(view);
  if (!state || state.matches.length === 0) {
    return [];
  }

  const contentFrom = nodePos + 1;
  const contentTo = nodePos + node.nodeSize - 1;

  return buildCodeMirrorFindHighlightRanges({
    matches: state.matches,
    activeIndex: state.activeIndex,
    contentFrom,
    contentTo,
    rawText: node.textContent ?? '',
    mapDocumentOffsetToEditorOffset: mapDocumentOffsetToCodeBlockEditorOffset,
  });
}

export function syncFrontmatterFindHighlightRanges(
  cm: CodeMirror,
  ranges: ReturnType<typeof buildCodeMirrorFindHighlightRanges>,
): void {
  syncCodeMirrorFindHighlights(cm, ranges);
}

export function getFrontmatterSelectionMirror(
  view: EditorView,
  node: Node,
  nodePos: number | undefined,
) {
  if (nodePos === undefined) {
    return null;
  }

  const contentFrom = nodePos + 1;
  const contentTo = nodePos + node.nodeSize - 1;
  const selectionFrom = Math.max(view.state.selection.from, contentFrom);
  const selectionTo = Math.min(view.state.selection.to, contentTo);
  if (selectionTo <= selectionFrom) {
    return null;
  }

  const rawText = node.textContent ?? '';
  return {
    anchor: mapDocumentOffsetToCodeBlockEditorOffset(rawText, selectionFrom - contentFrom),
    head: mapDocumentOffsetToCodeBlockEditorOffset(rawText, selectionTo - contentFrom),
  };
}

export function clearMirroredFrontmatterSelection(cm: CodeMirror, mirroredOuterSelection: boolean): boolean {
  if (!mirroredOuterSelection || cm.hasFocus) {
    return cm.hasFocus ? mirroredOuterSelection : false;
  }

  const { main } = cm.state.selection;
  if (!main.empty) {
    cm.dispatch({
      selection: {
        anchor: main.head,
        head: main.head,
      },
    });
  }
  return false;
}

export function shouldStopFrontmatterEvent(dom: HTMLElement, event: Event): boolean {
  const target = event.target;
  if (
    dom.dataset.pmSelected === 'true' ||
    dom.classList.contains('editor-block-selected')
  ) {
    if (event.type === 'copy' || event.type === 'cut' || event.type === 'paste') {
      return false;
    }

    if (event instanceof KeyboardEvent) {
      if (event.isComposing) {
        return true;
      }

      const key = event.key.toLowerCase();
      if (
        key === 'delete' ||
        key === 'backspace' ||
        ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key === 'insert') ||
        (!(event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && key === 'insert') ||
        key === 'x' ||
        key === 'c'
      ) {
        return false;
      }
    }
  }

  return target instanceof globalThis.Node && dom.contains(target);
}
