import { Selection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { getCurrentEditorView } from './editorViewRegistry';

function getEditorElement(): HTMLElement | null {
  return document.querySelector('.milkdown .ProseMirror');
}

function focusEditorDomStart(editorEl: HTMLElement): void {
  editorEl.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editorEl);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function focusSelectionAtStart(view: EditorView): void {
  const tr = view.state.tr
    .setSelection(Selection.atStart(view.state.doc))
    .scrollIntoView();
  view.dispatch(tr);
  view.focus();
}

export function focusEditorToFirstLineStart(): void {
  const view = getCurrentEditorView();
  if (view) {
    focusSelectionAtStart(view);
    return;
  }

  const editorEl = getEditorElement();
  if (!editorEl) return;
  focusEditorDomStart(editorEl);
}

export function focusEditorAtTop(): void {
  const view = getCurrentEditorView();

  if (view) {
    const firstChild = view.state.doc.firstChild;
    const hasTopEmptyParagraph =
      firstChild?.type === view.state.schema.nodes.paragraph && firstChild.content.size === 0;

    let tr = view.state.tr;
    if (!hasTopEmptyParagraph) {
      const paragraphType = view.state.schema.nodes.paragraph;
      if (paragraphType) {
        tr = tr.insert(0, paragraphType.create());
      }
    }

    tr = tr
      .setSelection(Selection.atStart(tr.doc))
      .scrollIntoView();
    view.dispatch(tr);
    view.focus();
    return;
  }

  const editorEl = getEditorElement();
  if (!editorEl) return;
  focusEditorDomStart(editorEl);
}
