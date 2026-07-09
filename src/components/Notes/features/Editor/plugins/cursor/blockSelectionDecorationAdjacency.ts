import type { EditorState } from '@milkdown/kit/prose/state';
import type { BlockRange } from './blockSelectionTypes';
import {
  MARKDOWN_BLANK_LINE_VALUE,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE,
} from './markdownBlankLineShared';

const BLANK_HTML_BLOCK_VALUES = new Set([
  '',
  MARKDOWN_BLANK_LINE_VALUE,
  RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE,
]);

function isAdjacentTextlikeBlockNode(node: EditorState['doc']): boolean {
  if (node.type.name === 'paragraph') return true;
  if (node.type.name !== 'html_block') return false;

  const value = typeof node.attrs?.value === 'string'
    ? node.attrs.value
    : node.textContent;
  return BLANK_HTML_BLOCK_VALUES.has(value.trim());
}

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

function resolveAdjacentTextlikeBlockBoundsForRange(
  doc: EditorState['doc'],
  range: BlockRange,
): { contentFrom: number; contentTo: number; nodeFrom: number; nodeTo: number } | null {
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  const safeTo = Math.max(safeFrom, Math.min(range.to, doc.content.size));

  try {
    let coveredParagraph: { contentFrom: number; contentTo: number; nodeFrom: number; nodeTo: number } | null = null;
    doc.nodesBetween(safeFrom, safeTo, (node, pos) => {
      if (coveredParagraph || !isAdjacentTextlikeBlockNode(node)) return false;
      if (range.from > pos || range.to > pos + node.nodeSize) return false;
      coveredParagraph = {
        contentFrom: pos + 1,
        contentTo: pos + node.nodeSize - 1,
        nodeFrom: pos,
        nodeTo: pos + node.nodeSize,
      };
      return false;
    });
    if (coveredParagraph) return coveredParagraph;

    const $from = doc.resolve(safeFrom);
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'paragraph') continue;

      const paragraphFrom = depth === 0 ? 0 : $from.before(depth);
      return {
        contentFrom: paragraphFrom + 1,
        contentTo: paragraphFrom + node.nodeSize - 1,
        nodeFrom: paragraphFrom,
        nodeTo: paragraphFrom + node.nodeSize,
      };
    }
  } catch {
  }

  return null;
}

function isRangeAtParagraphContentEnd(doc: EditorState['doc'], range: BlockRange): boolean {
  const bounds = resolveAdjacentTextlikeBlockBoundsForRange(doc, range);
  return bounds !== null && range.to === bounds.contentTo;
}

function isRangeAtParagraphNodeEnd(doc: EditorState['doc'], range: BlockRange): boolean {
  const bounds = resolveAdjacentTextlikeBlockBoundsForRange(doc, range);
  return bounds !== null && range.from <= bounds.nodeFrom && range.to === bounds.nodeTo;
}

export function areBlockSelectionDisplayRangesVisuallyAdjacent(
  doc: EditorState['doc'],
  current: BlockRange,
  next: BlockRange,
): boolean {
  if (current.to === next.from) return true;
  if (current.to + 1 !== next.from) return false;

  return isRangeAtParagraphContentEnd(doc, current) || isRangeAtParagraphNodeEnd(doc, current);
}
