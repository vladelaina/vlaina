import type { EditorView } from '@milkdown/kit/prose/view';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import type { BlockRange } from './blockSelectionUtils';

const LINE_FILL_LAYER_CLASS = 'vlaina-block-selection-line-fill-layer';
const LINE_FILL_CLASS = 'vlaina-block-selection-line-fill';
const ROW_MERGE_TOLERANCE_PX = 2;
const FALLBACK_BLOCK_SELECTION_BLEED_X_END_PX = 10;

interface LineFillOverlay {
  update: (view: EditorView) => void;
  destroy: () => void;
}

interface RowRect {
  top: number;
  right: number;
  bottom: number;
}

function isHardBreakNodeName(name: string): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

function isRangeIntersecting(left: BlockRange, right: BlockRange): boolean {
  return left.to > right.from && left.from < right.to;
}

function readCssPx(style: CSSStyleDeclaration, property: string, fallback = 0): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
}

function resolveBlockSelectionBleedXEnd(paragraph: HTMLElement): number {
  const selectedElement = paragraph.querySelector<HTMLElement>('.vlaina-block-selected') ?? paragraph;
  return readCssPx(
    window.getComputedStyle(selectedElement),
    '--vlaina-block-selection-bleed-x-end',
    FALLBACK_BLOCK_SELECTION_BLEED_X_END_PX
  );
}

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

function collectSelectedHardBreakLineRanges(view: EditorView): BlockRange[] {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  if (selectedBlocks.length === 0) return [];

  const ranges: BlockRange[] = [];
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return true;

    const paragraphFrom = pos;
    const paragraphTo = pos + node.nodeSize;
    const isSelectedParagraph = selectedBlocks.some((block) => (
      isRangeIntersecting(block, { from: paragraphFrom, to: paragraphTo })
    ));
    if (!isSelectedParagraph) return false;

    const contentFrom = paragraphFrom + 1;
    const contentTo = paragraphTo - 1;
    let lineFrom = contentFrom;
    let hasHardBreak = false;

    node.forEach((child, childOffset) => {
      if (!isHardBreakNodeName(child.type.name)) return;
      hasHardBreak = true;

      const lineTo = contentFrom + childOffset + child.nodeSize;
      const lineRange = { from: lineFrom, to: lineTo };
      if (
        lineTo > lineFrom &&
        selectedBlocks.some((block) => isRangeIntersecting(block, lineRange))
      ) {
        ranges.push(lineRange);
      }
      lineFrom = lineTo;
    });

    if (
      hasHardBreak &&
      lineFrom < contentTo &&
      selectedBlocks.some((block) => isRangeIntersecting(block, { from: lineFrom, to: contentTo }))
    ) {
      ranges.push({ from: lineFrom, to: contentTo });
    }

    return false;
  });

  return ranges;
}

function collectRangeRows(view: EditorView, range: BlockRange): RowRect[] {
  const measuredRange = trimTrailingHardBreakForMeasure(view, range);
  if (!measuredRange) return [];

  const domRange = view.dom.ownerDocument.createRange();
  try {
    const start = view.domAtPos(measuredRange.from);
    const end = view.domAtPos(measuredRange.to);
    domRange.setStart(start.node, start.offset);
    domRange.setEnd(end.node, end.offset);

    const rows: RowRect[] = [];
    for (const rect of Array.from(domRange.getClientRects())) {
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

function resolveParagraphElement(view: EditorView, range: BlockRange): HTMLElement | null {
  try {
    const domAtPos = view.domAtPos(range.from);
    const base = domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement;
    const paragraph = base?.closest('p') ?? null;
    return paragraph instanceof HTMLElement && view.dom.contains(paragraph) ? paragraph : null;
  } catch {
    return null;
  }
}

export function createBlockSelectionLineFillOverlay(view: EditorView): LineFillOverlay {
  const doc = view.dom.ownerDocument;
  const host = view.dom.parentElement ?? view.dom;
  if (host instanceof HTMLElement) {
    host.classList.add('vlaina-block-selection-line-fill-host');
  }
  const layer = doc.createElement('div');
  layer.className = LINE_FILL_LAYER_CLASS;
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);

  const update = (updatedView: EditorView) => {
    layer.replaceChildren();
    const currentHost = layer.parentElement ?? updatedView.dom;
    const hostRect = currentHost.getBoundingClientRect();
    const ranges = collectSelectedHardBreakLineRanges(updatedView);

    for (const range of ranges) {
      const paragraph = resolveParagraphElement(updatedView, range);
      if (!paragraph) continue;

      const paragraphRect = paragraph.getBoundingClientRect();
      const fillRight = paragraphRect.right + resolveBlockSelectionBleedXEnd(paragraph);
      const rows = collectRangeRows(updatedView, range);
      for (const row of rows) {
        const fillLeft = Math.max(row.right, paragraphRect.left);
        if (fillRight - fillLeft <= 0.5) continue;

        const fill = doc.createElement('div');
        fill.className = LINE_FILL_CLASS;
        fill.style.left = `${fillLeft - hostRect.left}px`;
        fill.style.top = `${row.top - hostRect.top}px`;
        fill.style.width = `${fillRight - fillLeft}px`;
        fill.style.height = `${row.bottom - row.top}px`;
        layer.appendChild(fill);
      }
    }
  };

  update(view);

  return {
    update,
    destroy() {
      if (host instanceof HTMLElement) {
        host.classList.remove('vlaina-block-selection-line-fill-host');
      }
      layer.remove();
    },
  };
}
