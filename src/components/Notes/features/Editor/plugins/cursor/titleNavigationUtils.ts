import type { EditorView } from '@milkdown/kit/prose/view';

const FIRST_VISUAL_LINE_TOLERANCE_PX = 4;

function isOnFirstDocumentPath(view: EditorView): boolean {
  const { $from } = view.state.selection;
  if (!$from || typeof $from.index !== 'function') return false;

  const depth = typeof $from.depth === 'number' ? $from.depth : 0;
  const deepestNode = typeof $from.node === 'function' ? $from.node(depth) : null;
  const ignoreDeepestInlineIndex = depth > 0 && (deepestNode?.isTextblock ?? true);
  for (let level = 0; level <= depth; level += 1) {
    if (level === depth && ignoreDeepestInlineIndex) continue;
    if ($from.index(level) !== 0) return false;
  }

  return true;
}

function isOnFirstVisualLine(view: EditorView): boolean {
  const { selection } = view.state;
  const $from = selection.$from;
  const depth = typeof $from.depth === 'number' ? $from.depth : 0;
  if (depth <= 0 || typeof $from.start !== 'function' || typeof view.coordsAtPos !== 'function') {
    return false;
  }

  try {
    const lineStart = view.coordsAtPos($from.start(depth));
    const caret = view.coordsAtPos(selection.from);
    return caret.top <= lineStart.top + FIRST_VISUAL_LINE_TOLERANCE_PX;
  } catch {
    return false;
  }
}

export function shouldMoveSelectionToTitle(view: EditorView): boolean {
  const { selection } = view.state;
  if (!selection?.empty) return false;

  if (!isOnFirstDocumentPath(view)) return false;

  // Respect visual line behavior: only jump when caret cannot move up anymore.
  if (typeof view.endOfTextblock === 'function' && view.endOfTextblock('up')) return true;

  return isOnFirstVisualLine(view);
}
