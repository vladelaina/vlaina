import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { markEditorUserInput } from '../shared/userInputEvents';
import { clearPreviewOverlay } from './previewAppliedRenderer';
import { previewStyleState } from './previewStyleState';

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

  markEditorUserInput(view);
  view.dispatch(tr);
  return true;
}

export function commitPreview(view: EditorView, key: string): boolean {
  const previewOverlay = previewStyleState.previewOverlay;
  if (
    !previewOverlay ||
    previewOverlay.viewDom !== view.dom ||
    previewOverlay.key !== key ||
    !view.state.doc.eq(previewOverlay.originalDoc)
  ) {
    return false;
  }

  if (previewOverlay.previewState.doc.eq(view.state.doc)) {
    clearPreviewOverlay();
    return false;
  }

  return dispatchPreviewState(view, previewOverlay.previewState);
}
