import type { EditorView } from '@milkdown/kit/prose/view';

export function shouldMoveSelectionToTitle(view: EditorView): boolean {
  const { selection } = view.state;
  if (!selection?.empty) return false;

  // Must be inside the first top-level block.
  if (selection.$from?.index?.(0) !== 0) return false;

  // Respect visual line behavior: only jump when caret cannot move up anymore.
  if (typeof view.endOfTextblock === 'function' && !view.endOfTextblock('up')) return false;

  return true;
}
