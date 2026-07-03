import { Selection, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { getCurrentEditorView } from './editorViewRegistry';

export interface EditorViewportPoint {
  clientX: number;
  clientY: number;
}

function createSelectionAtViewportPoint(
  view: EditorView,
  point: EditorViewportPoint,
): Selection | null {
  const resolved = view.posAtCoords({
    left: point.clientX,
    top: point.clientY,
  });
  if (!resolved) {
    return null;
  }

  const pos = Math.max(0, Math.min(resolved.pos, view.state.doc.content.size));
  const $pos = view.state.doc.resolve(pos);
  if (!$pos.parent.inlineContent) {
    return Selection.near($pos, 1);
  }

  try {
    return TextSelection.create(view.state.doc, pos);
  } catch {
    return Selection.near($pos, 1);
  }
}

export function focusCurrentEditorAtViewportPoint(point: EditorViewportPoint): boolean {
  const view = getCurrentEditorView();
  if (!view) {
    return false;
  }

  const selection = createSelectionAtViewportPoint(view, point);
  if (selection) {
    view.dispatch(
      view.state.tr
        .setSelection(selection)
        .scrollIntoView()
    );
  }
  window.focus();
  view.dom.focus({ preventScroll: true });
  view.focus();
  return true;
}
