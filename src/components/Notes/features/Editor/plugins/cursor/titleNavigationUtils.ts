import type { EditorView } from '@milkdown/kit/prose/view';

function isOnFirstDocumentPath(view: EditorView): boolean {
  const { $from } = view.state.selection;
  if (!$from || typeof $from.index !== 'function') return false;

  const depth = typeof $from.depth === 'number' ? $from.depth : 0;
  for (let level = 0; level <= depth; level += 1) {
    if ($from.index(level) !== 0) return false;
  }

  return true;
}

export function shouldMoveSelectionToTitle(view: EditorView): boolean {
  const { selection } = view.state;
  if (!selection?.empty) return false;

  if (!isOnFirstDocumentPath(view)) return false;

  // Respect visual line behavior: only jump when caret cannot move up anymore.
  if (typeof view.endOfTextblock === 'function' && !view.endOfTextblock('up')) return false;

  return true;
}
