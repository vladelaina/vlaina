import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION } from './blockSelectionPluginState';
import {
  findTopLevelBlockAfter,
  findTopLevelBlockBefore,
  isEditableMarkdownBlankLineNode,
} from './markdownBlankLineShared';

function getPlainDeleteDirection(event: KeyboardEvent): -1 | 1 | null {
  if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) {
    return null;
  }

  if (event.key === 'Backspace') return -1;
  if (event.key === 'Delete') return 1;
  return null;
}

export function handleEditableMarkdownBlankLineAfterHeadingDelete(
  view: EditorView,
): boolean {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.depth !== 1 || !isEditableMarkdownBlankLineNode($from.parent)) return false;

  const blockFrom = $from.before(1);
  const blockTo = $from.after(1);
  const previousBlock = findTopLevelBlockBefore(view.state.doc, blockFrom);
  if (previousBlock?.node.type.name !== 'heading') {
    return false;
  }

  const nextBlock = findTopLevelBlockAfter(view.state.doc, blockTo);
  if (nextBlock && nextBlock.node.type.name !== 'paragraph') {
    return false;
  }

  const headingEnd = previousBlock.from + 1 + previousBlock.node.content.size;
  let tr = view.state.tr.delete(blockFrom, blockTo);
  tr = tr
    .setSelection(TextSelection.create(tr.doc, headingEnd))
    .setMeta(blankAreaDragBoxPluginKey, CLEAR_BLOCKS_ACTION);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function handleEditableMarkdownBlankLineAfterHeadingKeyboardDelete(
  view: EditorView,
  event: KeyboardEvent,
): boolean {
  if (!getPlainDeleteDirection(event)) return false;

  const handled = handleEditableMarkdownBlankLineAfterHeadingDelete(view);
  if (!handled) return false;

  event.preventDefault();
  return true;
}
