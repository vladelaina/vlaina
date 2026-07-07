import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRange } from './blockSelectionUtils';
import {
  isHardBreakNodeName,
  MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS,
  MAX_BLOCK_SELECTION_LINE_FILL_ROWS_PER_RANGE,
  ROW_MERGE_TOLERANCE_PX,
  type RowRect,
} from './blockSelectionLineFillConstants';

function trimTrailingHardBreakForMeasure(view: EditorView, range: BlockRange): BlockRange | null {
  try {
    const nodeBefore = view.state.doc.resolve(range.to).nodeBefore;
    if (!nodeBefore || !isHardBreakNodeName(nodeBefore.type.name)) return range;

    const to = range.to - nodeBefore.nodeSize;
    return to > range.from ? { from: range.from, to } : null;
  } catch {
    return range;
  }
}

export function collectRangeRows(view: EditorView, range: BlockRange): RowRect[] {
  const measuredRange = trimTrailingHardBreakForMeasure(view, range);
  if (!measuredRange) return [];

  const domRange = view.dom.ownerDocument.createRange();
  try {
    const start = view.domAtPos(measuredRange.from);
    const end = view.domAtPos(measuredRange.to);
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);

    const rows: RowRect[] = [];
    const rects = domRange.getClientRects();
    if (rects.length > MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS) {
      return [];
    }

    for (let index = 0; index < rects.length; index += 1) {
      const rect = rects.item?.(index) ?? rects[index];
      if (!rect) continue;
      if (rect.height <= 0) continue;
      const centerY = rect.top + rect.height / 2;
      const existing = rows.find((row) => (
        centerY >= row.top - ROW_MERGE_TOLERANCE_PX &&
        centerY <= row.bottom + ROW_MERGE_TOLERANCE_PX
      ));
      if (existing) {
        existing.top = Math.min(existing.top, rect.top);
        existing.right = Math.max(existing.right, rect.right);
        existing.bottom = Math.max(existing.bottom, rect.bottom);
      } else {
        if (rows.length >= MAX_BLOCK_SELECTION_LINE_FILL_ROWS_PER_RANGE) break;
        rows.push({ top: rect.top, right: rect.right, bottom: rect.bottom });
      }
    }
    return rows.sort((left, right) => left.top - right.top);
  } catch {
    return [];
  } finally {
    domRange.detach();
  }
}
