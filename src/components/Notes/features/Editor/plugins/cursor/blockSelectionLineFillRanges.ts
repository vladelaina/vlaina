import type { EditorView } from '@milkdown/kit/prose/view';
import { getBlockSelectionPluginState } from './blockSelectionPluginState';
import {
  normalizeBlockRanges,
  type BlockRange,
} from './blockSelectionUtils';
import {
  isHardBreakNodeName,
  MAX_BLOCK_SELECTION_LINE_FILL_RANGES,
  type ProseNodeLike,
} from './blockSelectionLineFillConstants';

function isRangeIntersecting(left: BlockRange, right: BlockRange): boolean {
  return left.to > right.from && left.from < right.to;
}

function appendSelectedParagraphLineRanges(
  paragraph: ProseNodeLike,
  paragraphFrom: number,
  selectedRange: BlockRange,
  ranges: BlockRange[],
): boolean {
  const paragraphTo = paragraphFrom + paragraph.nodeSize;
  if (!isRangeIntersecting(selectedRange, { from: paragraphFrom, to: paragraphTo })) {
    return true;
  }

  const contentFrom = paragraphFrom + 1;
  const contentTo = paragraphTo - 1;
  let lineFrom = contentFrom;
  let hasHardBreak = false;
  let childOffset = 0;

  for (
    let childIndex = 0;
    childIndex < paragraph.childCount && ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES;
    childIndex += 1
  ) {
    const child = paragraph.child(childIndex);
    if (!isHardBreakNodeName(child.type.name)) {
      childOffset += child.nodeSize;
      continue;
    }

    hasHardBreak = true;
    const lineTo = contentFrom + childOffset + child.nodeSize;
    const lineRange = { from: lineFrom, to: lineTo };
    if (lineTo > lineFrom && isRangeIntersecting(selectedRange, lineRange)) {
      ranges.push(lineRange);
    }
    lineFrom = lineTo;
    childOffset += child.nodeSize;
  }

  if (
    ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES &&
    hasHardBreak &&
    lineFrom < contentTo &&
    isRangeIntersecting(selectedRange, { from: lineFrom, to: contentTo })
  ) {
    ranges.push({ from: lineFrom, to: contentTo });
  }

  return ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES;
}

function collectSelectedHardBreakLineRangesFromNode(
  node: ProseNodeLike,
  contentStart: number,
  selectedRanges: readonly BlockRange[],
  startRangeIndex: number,
  ranges: BlockRange[],
): number {
  let rangeIndex = startRangeIndex;
  let childOffset = 0;
  for (let index = 0; index < node.childCount; index += 1) {
    if (ranges.length >= MAX_BLOCK_SELECTION_LINE_FILL_RANGES) break;

    const child = node.child(index);
    const childFrom = contentStart + childOffset;
    const childTo = childFrom + child.nodeSize;
    childOffset += child.nodeSize;

    while (
      rangeIndex < selectedRanges.length &&
      selectedRanges[rangeIndex].to <= childFrom
    ) {
      rangeIndex += 1;
    }
    if (rangeIndex >= selectedRanges.length) break;
    if (childTo <= selectedRanges[rangeIndex].from) continue;

    if (child.type.name === 'paragraph') {
      for (
        let selectedIndex = rangeIndex;
        selectedIndex < selectedRanges.length &&
          selectedRanges[selectedIndex].from < childTo &&
          ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES;
        selectedIndex += 1
      ) {
        const selectedRange = selectedRanges[selectedIndex];
        if (isRangeIntersecting(selectedRange, { from: childFrom, to: childTo })) {
          appendSelectedParagraphLineRanges(child, childFrom, selectedRange, ranges);
        }
      }
      continue;
    }

    if (
      child.childCount > 0 &&
      ranges.length < MAX_BLOCK_SELECTION_LINE_FILL_RANGES
    ) {
      rangeIndex = collectSelectedHardBreakLineRangesFromNode(
        child,
        childFrom + 1,
        selectedRanges,
        rangeIndex,
        ranges,
      );
    }
  }

  return rangeIndex;
}

export function collectSelectedHardBreakLineRanges(view: EditorView): BlockRange[] {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  if (selectedBlocks.length === 0) return [];

  const ranges: BlockRange[] = [];
  const selectedRanges = normalizeBlockRanges(selectedBlocks);

  const docSize = view.state.doc.content.size;
  const clampedRanges = selectedRanges
    .map((range) => {
      const from = Math.max(0, Math.min(range.from, docSize));
      const to = Math.max(from, Math.min(range.to, docSize));
      return { from, to };
    })
    .filter((range) => range.to > range.from);

  collectSelectedHardBreakLineRangesFromNode(
    view.state.doc,
    0,
    clampedRanges,
    0,
    ranges,
  );

  return normalizeBlockRanges(ranges);
}
