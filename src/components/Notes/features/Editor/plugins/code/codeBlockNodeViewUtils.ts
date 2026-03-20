import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { ViewUpdate } from '@codemirror/view';
import { mapCodeBlockEditorOffsetToDocumentOffset } from './codemirror';

export function forwardCodeBlockUpdate(
  update: ViewUpdate,
  view: EditorView,
  getPos: () => number | undefined
) {
  const codeBlockPos = getPos() ?? 0;
  const codeBlockStart = codeBlockPos + 1;
  const { main } = update.state.selection;
  const currentDoc =
    view.state.doc as { nodeAt?: (pos: number) => { textContent: string } | null } | undefined;
  const currentCodeBlock =
    typeof currentDoc?.nodeAt === 'function' ? currentDoc.nodeAt(codeBlockPos) : null;
  const currentRawText = currentCodeBlock?.textContent ?? '';
  const currentSelectionFrom =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, main.from);
  const currentSelectionTo =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, main.to);
  const pmSelection = view.state.selection;

  if (!update.docChanged && pmSelection.from === currentSelectionFrom && pmSelection.to === currentSelectionTo) {
    return null;
  }

  const tr = view.state.tr;
  update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
    const from = tr.mapping.map(
      codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, fromA),
      -1
    );
    const to = tr.mapping.map(
      codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(currentRawText, toA),
      1
    );
    if (text.length > 0) {
      tr.replaceWith(from, to, view.state.schema.text(text.toString()));
    } else {
      tr.delete(from, to);
    }
  });

  const nextCodeBlock =
    typeof (tr.doc as { nodeAt?: (pos: number) => { textContent: string } | null }).nodeAt === 'function'
      ? (tr.doc as { nodeAt: (pos: number) => { textContent: string } | null }).nodeAt(codeBlockPos)
      : null;
  const nextRawText = nextCodeBlock?.textContent ?? '';
  const nextSelectionFrom =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(nextRawText, main.from);
  const nextSelectionTo =
    codeBlockStart + mapCodeBlockEditorOffsetToDocumentOffset(nextRawText, main.to);
  tr.setSelection(TextSelection.create(tr.doc, nextSelectionFrom, nextSelectionTo));
  return tr;
}

export function applyCodeBlockCollapsedState(dom: HTMLElement, editorDOM: HTMLElement, collapsed: boolean) {
  dom.setAttribute('data-collapsed', String(collapsed));
  editorDOM.style.display = collapsed ? 'none' : '';
  if (collapsed) {
    editorDOM.setAttribute('aria-hidden', 'true');
    editorDOM.tabIndex = -1;
    return;
  }

  editorDOM.removeAttribute('aria-hidden');
  editorDOM.removeAttribute('tabindex');
}
