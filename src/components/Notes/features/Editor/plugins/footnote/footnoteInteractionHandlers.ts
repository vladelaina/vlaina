import {
  Selection,
  TextSelection,
  type EditorState,
} from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { markEditorUserInput } from '../shared/userInputEvents';
import { isFootnoteReferenceNodeName } from './footnoteScan';

function findFootnoteDefinitionDepth(view: EditorView): number | null {
  const { selection } = view.state;
  const { $from } = selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const nodeName = $from.node(depth).type.name;
    if (nodeName === 'footnote_definition' || nodeName === 'footnote_def') {
      return depth;
    }
  }
  return null;
}

function isPlainFootnoteDeleteEvent(event: KeyboardEvent): boolean {
  return (
    (event.key === 'Delete' || event.key === 'Backspace')
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
    && !event.isComposing
  );
}

function isEmptyFootnoteDefinitionNode(node: { descendants?: (...args: any[]) => void; textContent?: string }): boolean {
  if ((node.textContent ?? '').trim().length > 0) {
    return false;
  }

  let hasNonTextLeafContent = false;
  node.descendants?.((child: any) => {
    if (child.isText) {
      return true;
    }
    if (child.isLeaf) {
      hasNonTextLeafContent = true;
      return false;
    }
    return true;
  });
  return !hasNonTextLeafContent;
}

function setSelectionNearDeletedFootnote(state: EditorState, tr: any, pos: number) {
  const docSize = tr.doc.content.size;
  const safePos = Math.max(0, Math.min(pos, docSize));
  const resolved = tr.doc.resolve(safePos);
  const selection = Selection.findFrom(resolved, 1, true)
    ?? Selection.findFrom(resolved, -1, true);
  if (selection) {
    return tr.setSelection(selection);
  }

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) {
    return tr;
  }

  tr.insert(safePos, paragraphType.create());
  return tr.setSelection(TextSelection.create(tr.doc, safePos + 1));
}

export function handleEmptyFootnoteDefinitionDelete(view: EditorView, event: KeyboardEvent): boolean {
  if (!isPlainFootnoteDeleteEvent(event)) {
    return false;
  }

  const { state } = view;
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }
  if (!selection.$from.parent.isTextblock || selection.$from.parent.textContent.trim().length > 0) {
    return false;
  }

  const footnoteDepth = findFootnoteDefinitionDepth(view);
  if (footnoteDepth === null) {
    return false;
  }

  const footnoteNode = selection.$from.node(footnoteDepth);
  if (!isEmptyFootnoteDefinitionNode(footnoteNode)) {
    return false;
  }

  const footnotePos = selection.$from.before(footnoteDepth);
  const tr = setSelectionNearDeletedFootnote(
    state,
    state.tr.delete(footnotePos, footnotePos + footnoteNode.nodeSize),
    footnotePos
  ).scrollIntoView();

  event.preventDefault();
  markEditorUserInput(view);
  view.dispatch(tr);
  view.focus();
  return true;
}

export function handleFootnoteArrowNavigation(view: EditorView, event: KeyboardEvent): boolean {
  if (
    (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    || event.metaKey
    || event.ctrlKey
    || event.altKey
    || event.shiftKey
    || event.isComposing
    || !view.state.selection.empty
  ) {
    return false;
  }

  const { $from } = view.state.selection;
  const adjacentNode = event.key === 'ArrowRight' ? $from.nodeAfter : $from.nodeBefore;
  if (!adjacentNode || !isFootnoteReferenceNodeName(adjacentNode.type.name)) {
    return false;
  }

  const nextPos = event.key === 'ArrowRight'
    ? $from.pos + adjacentNode.nodeSize
    : $from.pos - adjacentNode.nodeSize;

  event.preventDefault();
  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, nextPos))
      .scrollIntoView()
  );
  return true;
}

export function handleFootnoteModEnterExit(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  const paragraphType = state.schema.nodes.paragraph;
  if (!selection.empty || !paragraphType) {
    return false;
  }

  const footnoteDepth = findFootnoteDefinitionDepth(view);
  if (footnoteDepth === null) {
    return false;
  }

  const footnotePos = selection.$from.before(footnoteDepth);
  const footnoteNode = selection.$from.node(footnoteDepth);
  const insertPos = footnotePos + footnoteNode.nodeSize;
  let tr = state.tr.insert(insertPos, paragraphType.create());
  tr = tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)).scrollIntoView();
  markEditorUserInput(view);
  view.dispatch(tr);
  return true;
}
