import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { isMarkdownBlankLinePlaceholderNode } from './markdownBlankLineInteraction';
import {
  findTopLevelBlockAfter,
  findTopLevelBlockBefore,
} from './atomicBlockKeyboardShared';

function isPlainForwardDelete(event: KeyboardEvent): boolean {
  return event.key === 'Delete'
    && !event.shiftKey
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.isComposing;
}

export function handleDeleteAtHeadingEndBeforeBlankLine(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  if (!isPlainForwardDelete(event)) {
    return false;
  }

  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if ($from.depth !== 1 || $from.parent.type.name !== 'heading' || $from.parentOffset !== $from.parent.content.size) {
    return false;
  }

  const headingTo = $from.after(1);
  const nextBlock = findTopLevelBlockAfter(view.state.doc, headingTo);
  const isEmptyParagraph = nextBlock?.node.type.name === 'paragraph' && nextBlock.node.content.size === 0;
  if (!nextBlock || (!isMarkdownBlankLinePlaceholderNode(nextBlock.node) && !isEmptyParagraph)) {
    return false;
  }

  const tr = view.state.tr.delete(nextBlock.from, nextBlock.to);
  tr.setSelection(TextSelection.create(tr.doc, selection.from));

  event.preventDefault();
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

export function handleDeleteAtLeadingHardBreakAfterHeading(
  view: EditorView,
  event: KeyboardEvent
): boolean {
  if (!isPlainForwardDelete(event)) {
    return false;
  }

  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if ($from.depth !== 1 || $from.parent.type.name !== 'paragraph' || $from.parentOffset !== 0) {
    return false;
  }

  if ($from.parent.childCount === 0 || $from.parent.child(0).type.name !== 'hardbreak') {
    return false;
  }

  const paragraphFrom = $from.before(1);
  const previousBlock = findTopLevelBlockBefore(view.state.doc, paragraphFrom);
  if (previousBlock?.node.type.name !== 'heading') {
    return false;
  }

  const headingEnd = previousBlock.from + 1 + previousBlock.node.content.size;
  const tr = view.state.tr.delete(selection.from, selection.from + 1);
  tr.setSelection(TextSelection.create(tr.doc, headingEnd));

  event.preventDefault();
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
