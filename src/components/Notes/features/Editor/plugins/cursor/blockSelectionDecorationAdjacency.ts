import type { EditorState } from '@milkdown/kit/prose/state';
import type { BlockRange } from './blockSelectionTypes';

export function isPartialParagraphRange(doc: EditorState['doc'], range: BlockRange): boolean {
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));

  try {
    const $from = doc.resolve(safeFrom);
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'paragraph') continue;

      const paragraphFrom = depth === 0 ? 0 : $from.before(depth);
      const paragraphTo = paragraphFrom + node.nodeSize;
      return range.from > paragraphFrom || range.to < paragraphTo;
    }
  } catch {
  }

  return false;
}

function resolveParagraphContentBoundsForRange(
  doc: EditorState['doc'],
  range: BlockRange,
): { from: number; to: number } | null {
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));

  try {
    const $from = doc.resolve(safeFrom);
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'paragraph') continue;

      const paragraphFrom = depth === 0 ? 0 : $from.before(depth);
      return {
        from: paragraphFrom + 1,
        to: paragraphFrom + node.nodeSize - 1,
      };
    }
  } catch {
  }

  return null;
}

function isRangeAtParagraphContentStart(doc: EditorState['doc'], range: BlockRange): boolean {
  const bounds = resolveParagraphContentBoundsForRange(doc, range);
  return bounds !== null && range.from === bounds.from;
}

function isRangeAtParagraphContentEnd(doc: EditorState['doc'], range: BlockRange): boolean {
  const bounds = resolveParagraphContentBoundsForRange(doc, range);
  return bounds !== null && range.to === bounds.to;
}

export function areBlockSelectionDisplayRangesVisuallyAdjacent(
  doc: EditorState['doc'],
  current: BlockRange,
  next: BlockRange,
): boolean {
  if (current.to === next.from) return true;
  if (current.to + 1 !== next.from) return false;

  return (
    isRangeAtParagraphContentEnd(doc, current) ||
    isRangeAtParagraphContentStart(doc, next)
  );
}
