import type { EditorView } from '@milkdown/kit/prose/view';

import { openPairSpecs } from './pairSpecs';
import { hasAutoInsertedCloserAt } from './pairState';

function handleEmptyAutoPairDeletion(
  view: EditorView,
  event: KeyboardEvent,
  key: 'Backspace' | 'Delete',
): boolean {
  if (event.key !== key) return false;
  if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return false;

  const { selection } = view.state;
  if (!selection.empty) return false;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return false;
  if ($from.parentOffset === 0 || $from.parentOffset >= $from.parent.textContent.length) return false;

  const text = $from.parent.textContent;
  const open = text[$from.parentOffset - 1];
  const close = text[$from.parentOffset];
  const spec = openPairSpecs.get(open);
  if (!spec || spec.close !== close) return false;
  if (!hasAutoInsertedCloserAt(view.state, selection.from, close)) return false;

  view.dispatch(view.state.tr.delete(selection.from - 1, selection.from + 1));
  event.preventDefault();
  return true;
}

export function handleAutoPairBackspace(
  view: EditorView,
  event: KeyboardEvent,
): boolean {
  return handleEmptyAutoPairDeletion(view, event, 'Backspace');
}

export function handleAutoPairDelete(
  view: EditorView,
  event: KeyboardEvent,
): boolean {
  return handleEmptyAutoPairDeletion(view, event, 'Delete');
}
