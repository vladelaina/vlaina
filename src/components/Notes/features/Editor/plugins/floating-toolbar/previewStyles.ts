import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  createAppliedPreviewState,
  renderAppliedPreviewDocument,
} from './appliedPreviewState';
import {
  convertBlockType,
  setBgColor,
  setLink,
  setTextAlignment,
  setTextColor,
  toggleMark,
} from './commands';
import type { BlockType, TextAlignment } from './types';

const FORMAT_MARKS: Record<string, string> = {
  bold: 'strong',
  italic: 'emphasis',
  underline: 'underline',
  strike: 'strike_through',
  code: 'inlineCode',
  highlight: 'highlight',
};

let previewOverlay: {
  key: string;
  node: HTMLElement;
  originalDoc: EditorState['doc'];
  originalViewDisplay: string;
  previewState: EditorState;
  viewDom: HTMLElement;
} | null = null;

export function hasFormatPreview(action: string): boolean {
  return action in FORMAT_MARKS || action === 'link';
}

export function hasBlockPreview(blockType: BlockType): boolean {
  return (
    blockType === 'paragraph' ||
    blockType === 'heading1' ||
    blockType === 'heading2' ||
    blockType === 'heading3' ||
    blockType === 'heading4' ||
    blockType === 'heading5' ||
    blockType === 'heading6' ||
    blockType === 'bulletList' ||
    blockType === 'orderedList' ||
    blockType === 'taskList' ||
    blockType === 'blockquote' ||
    blockType === 'codeBlock'
  );
}

export function hasActiveAppliedPreview(view: EditorView): boolean {
  return Boolean(previewOverlay && previewOverlay.viewDom === view.dom);
}

function hasMatchingPreview(view: EditorView, key: string): boolean {
  return Boolean(
    previewOverlay &&
    previewOverlay.viewDom === view.dom &&
    previewOverlay.key === key &&
    view.state.doc.eq(previewOverlay.originalDoc)
  );
}

function createAppliedPreviewDom(
  view: EditorView,
  apply: (previewView: EditorView) => void
): { dom: HTMLElement; state: EditorState } | null {
  if (!(view.dom instanceof HTMLElement)) {
    return null;
  }

  const previewState = createAppliedPreviewState(view, apply);

  if (previewState.doc.eq(view.state.doc)) {
    return null;
  }

  return {
    dom: renderAppliedPreviewDocument(previewState, view.dom, view.dom.ownerDocument),
    state: previewState,
  };
}

function renderAppliedPreview(
  view: EditorView,
  key: string,
  apply: (previewView: EditorView) => void
): boolean {
  if (!(view.dom instanceof HTMLElement) || !(view.dom.parentElement instanceof HTMLElement)) {
    void key;
    return false;
  }

  if (hasMatchingPreview(view, key)) {
    return true;
  }

  clearPreviewOverlay();

  const preview = createAppliedPreviewDom(view, apply);
  if (!preview) {
    return false;
  }

  const parent = view.dom.parentElement;
  const previewDom = preview.dom;
  previewDom.classList.add('toolbar-applied-preview-overlay');
  previewDom.style.pointerEvents = 'none';

  previewOverlay = {
    key,
    node: previewDom,
    originalDoc: view.state.doc,
    originalViewDisplay: view.dom.style.display,
    previewState: preview.state,
    viewDom: view.dom,
  };

  parent.insertBefore(previewDom, view.dom);
  view.dom.style.display = 'none';
  view.dom.setAttribute('data-toolbar-preview-hidden', 'true');
  return true;
}

function clearPreviewOverlay(): void {
  if (!previewOverlay) {
    return;
  }

  const { node, originalViewDisplay, viewDom } = previewOverlay;
  node.remove();
  if (viewDom.isConnected) {
    viewDom.style.display = originalViewDisplay;
    viewDom.removeAttribute('data-toolbar-preview-hidden');
  }
  previewOverlay = null;
}

function setCollapsedSelectionNear(tr: EditorState['tr'], pos: number): void {
  const clampedPos = Math.max(0, Math.min(pos, tr.doc.content.size));

  try {
    tr.setSelection(TextSelection.create(tr.doc, clampedPos));
    return;
  } catch {
    // Fall back to the nearest valid cursor when the mapped end lands on a block boundary.
  }

  tr.setSelection(Selection.near(tr.doc.resolve(clampedPos), -1));
}

function dispatchPreviewState(view: EditorView, previewState: EditorState): boolean {
  const currentDoc = view.state.doc;
  const nextDoc = previewState.doc;
  const diffStart = (currentDoc.content as any).findDiffStart(nextDoc.content);

  if (diffStart === null) {
    if (!view.state.selection.empty) {
      const tr = view.state.tr;
      try {
        setCollapsedSelectionNear(tr, view.state.selection.to);
        view.dispatch(tr);
      } catch {
        return false;
      }
    }
    return true;
  }

  const diffEnd = (currentDoc.content as any).findDiffEnd(nextDoc.content);
  if (!diffEnd) {
    return false;
  }

  const tr = view.state.tr.replace(
    diffStart,
    diffEnd.a,
    nextDoc.slice(diffStart, diffEnd.b)
  );

  try {
    setCollapsedSelectionNear(tr, previewState.selection.to);
  } catch {
    // Keep ProseMirror's mapped selection if the preview selection cannot be restored.
  }

  view.dispatch(tr);
  return true;
}

function commitPreview(view: EditorView, key: string): boolean {
  if (
    !previewOverlay ||
    previewOverlay.viewDom !== view.dom ||
    previewOverlay.key !== key ||
    !view.state.doc.eq(previewOverlay.originalDoc)
  ) {
    return false;
  }

  return dispatchPreviewState(view, previewOverlay.previewState);
}

export function applyFormatPreview(view: EditorView, action: string, isActive: boolean = false): void {
  const key = `format:${action}:${isActive}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreview(view);

  const markName = FORMAT_MARKS[action];
  if (action === 'link') {
    if (!isActive) {
      return;
    }

    renderAppliedPreview(view, key, (previewView) => {
      setLink(previewView, null);
    });
    return;
  }

  if (!markName) {
    return;
  }

  renderAppliedPreview(view, key, (previewView) => {
    toggleMark(previewView, markName);
  });
}

export function applyTextColorPreview(view: EditorView, color: string | null): void {
  const key = `textColor:${color ?? 'default'}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreview(view);
  renderAppliedPreview(view, key, (previewView) => {
    setTextColor(previewView, color);
  });
}

export function applyBgColorPreview(view: EditorView, color: string | null): void {
  const key = `bgColor:${color ?? 'default'}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreview(view);
  renderAppliedPreview(view, key, (previewView) => {
    setBgColor(previewView, color);
  });
}

export function applyAlignmentPreview(view: EditorView, alignment: TextAlignment): void {
  const key = `alignment:${alignment}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreview(view);
  renderAppliedPreview(view, key, (previewView) => {
    setTextAlignment(previewView, alignment);
  });
}

export function applyBlockPreview(view: EditorView, blockType: BlockType): void {
  const key = `block:${blockType}`;
  if (hasMatchingPreview(view, key)) {
    return;
  }

  clearFormatPreview(view);
  renderAppliedPreview(view, key, (previewView) => {
    convertBlockType(previewView, blockType);
  });
}

export function commitFormatPreview(view: EditorView, action: string, isActive: boolean = false): boolean {
  return commitPreview(view, `format:${action}:${isActive}`);
}

export function commitTextColorPreview(view: EditorView, color: string | null): boolean {
  return commitPreview(view, `textColor:${color ?? 'default'}`);
}

export function commitBgColorPreview(view: EditorView, color: string | null): boolean {
  return commitPreview(view, `bgColor:${color ?? 'default'}`);
}

export function commitAlignmentPreview(view: EditorView, alignment: TextAlignment): boolean {
  return commitPreview(view, `alignment:${alignment}`);
}

export function commitBlockPreview(view: EditorView, blockType: BlockType): boolean {
  return commitPreview(view, `block:${blockType}`);
}

export function clearFormatPreview(view: EditorView): void {
  void view;
  clearPreviewOverlay();
}
