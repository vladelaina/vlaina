import type { EditorState } from '@milkdown/kit/prose/state';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import {
  LIST_ITEM_MARKER_PATTERN,
  ORDERED_LIST_ITEM_MARKER_PATTERN,
  renumberOrderedListMarker,
  resolveContainingListContainerInfo,
  resolveContainingListItemInfo,
  resolveTopLevelBlockInfo,
} from './blockSelectionListSerialization';
import { LIST_CONTAINER_NODE_NAMES } from '../shared/blockNodeTypes';

function isListContainerName(name: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(name);
}

function getOrderedListMarkerNumber(text: string): number | null {
  const match = ORDERED_LIST_ITEM_MARKER_PATTERN.exec(text);
  if (!match) return null;
  return Number(match[2]);
}

function getListContinuationIndent(text: string): string | null {
  const match = /^(\s*)([-+*]|\d+[.)])(\s+(?:\[(?: |x|X)\]\s+)?)?/.exec(text);
  if (!match) return null;
  const baseIndent = match[1] ?? '';
  const marker = match[2] ?? '';
  const suffix = match[3] ?? '';

  if (/^\d+[.)]$/.test(marker)) {
    return `${baseIndent}${' '.repeat(marker.length + Math.max(1, suffix.length))}`;
  }

  return `${baseIndent}  `;
}

function indentMarkdownBlock(text: string, indent: string): string {
  if (!indent) return text;
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `${indent}${line}` : line))
    .join('\n');
}

function rangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

function topLevelRangeKey(range: { from: number; to: number }): string {
  return `${range.from}:${range.to}`;
}

export function isWholeListContainerRange(state: EditorState, range: BlockRange): boolean {
  try {
    if (typeof state.doc?.forEach !== 'function') return false;
    const topLevel = resolveTopLevelBlockInfo(state.doc, range.from);
    return Boolean(
      topLevel
      && isListContainerName(topLevel.name)
      && topLevel.from === range.from
      && topLevel.to === range.to
    );
  } catch {
    return false;
  }
}

export function isWholeListItemRange(state: EditorState, range: BlockRange): boolean {
  try {
    if (typeof state.doc?.resolve !== 'function') return false;
    const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
    const nodeAfter = state.doc.resolve(safeFrom).nodeAfter;
    return Boolean(
      nodeAfter
      && nodeAfter.type.name === 'list_item'
      && safeFrom + nodeAfter.nodeSize === range.to
    );
  } catch {
    return false;
  }
}

export function isListItemChildRange(state: EditorState, range: BlockRange): boolean {
  const listItem = resolveContainingListItemInfo(state.doc, range.from);
  return Boolean(
    listItem
    && range.from > listItem.from
    && range.to <= listItem.to
    && !isWholeListItemRange(state, range)
    && !isWholeListContainerRange(state, range)
  );
}

export function joinSerializedBlockRanges(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
  pieces: readonly string[],
): string {
  if (pieces.length === 0) return '';
  if (pieces.length === 1) return pieces[0] || '\n';

  let joined = pieces[0] ?? '';
  let previousEmitted = joined;
  for (let index = 1; index < pieces.length; index += 1) {
    const previous = previousEmitted;
    const next = pieces[index] ?? '';

    let separator = '\n\n';
    if (previous.length === 0 || next.length === 0) {
      separator = '\n';
    } else if (LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next)) {
      const previousListContainer = resolveContainingListContainerInfo(doc, ranges[index - 1].from);
      const nextListContainer = resolveContainingListContainerInfo(doc, ranges[index].from);
      const sameListContainer =
        previousListContainer
        && nextListContainer
        && previousListContainer.from === nextListContainer.from
        && previousListContainer.to === nextListContainer.to;
      separator = sameListContainer ? '\n' : '\n\n';
      if (sameListContainer && previousListContainer.name === 'ordered_list') {
        const previousNumber = getOrderedListMarkerNumber(previous);
        if (previousNumber !== null) {
          const nextNumber = getOrderedListMarkerNumber(next);
          const emittedNext =
            nextNumber === null || nextNumber <= previousNumber
              ? renumberOrderedListMarker(next, previousNumber + 1)
              : next;
          joined += separator + emittedNext;
          previousEmitted = emittedNext;
          continue;
        }
      }
    }

    const previousListItem = resolveContainingListItemInfo(doc, ranges[index - 1].from);
    const nextListItem = resolveContainingListItemInfo(doc, ranges[index].from);
    const nextListContainer = resolveContainingListContainerInfo(doc, ranges[index].from);
    const nextIsChildOfPreviousItem =
      previousListItem
      && nextListContainer
      && nextListContainer.from > previousListItem.from
      && nextListContainer.to <= previousListItem.to;
    const nextIsContentOfPreviousItem =
      previousListItem
      && nextListItem
      && previousListItem.from === nextListItem.from
      && previousListItem.to === nextListItem.to
      && ranges[index].from > ranges[index - 1].from;
    const previousMarkerIndent = getListContinuationIndent(previous);
    if ((nextIsChildOfPreviousItem || nextIsContentOfPreviousItem) && previousMarkerIndent) {
      const indentedNext = indentMarkdownBlock(next, previousMarkerIndent);
      joined += '\n' + indentedNext;
      previousEmitted = indentedNext;
      continue;
    }

    joined += separator + next;
    previousEmitted = next;
  }

  return joined.length === 0 ? '\n' : joined;
}

export function collapseCompleteSelectedListContainers(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
): BlockRange[] {
  if (ranges.length <= 1) return [...ranges];
  if (typeof doc?.forEach !== 'function') return [...ranges];

  const selectedKeys = new Set(ranges.map(rangeKey));
  let allSelectableRanges: BlockRange[] = [];
  try {
    allSelectableRanges = collectSelectableBlockRanges(doc);
  } catch {
    return [...ranges];
  }
  const selectableRangesByTopLevelList = new Map<string, BlockRange[]>();
  for (const range of allSelectableRanges) {
    const topLevel = resolveTopLevelBlockInfo(doc, range.from);
    if (!topLevel || !isListContainerName(topLevel.name)) continue;
    const key = topLevelRangeKey(topLevel);
    const listRanges = selectableRangesByTopLevelList.get(key);
    if (listRanges) {
      listRanges.push(range);
    } else {
      selectableRangesByTopLevelList.set(key, [range]);
    }
  }
  const output: BlockRange[] = [];
  let index = 0;

  while (index < ranges.length) {
    const block = ranges[index];
    const topLevel = resolveTopLevelBlockInfo(doc, block.from);
    if (!topLevel || !isListContainerName(topLevel.name)) {
      output.push(block);
      index += 1;
      continue;
    }

    const listRange = { from: topLevel.from, to: topLevel.to };
    const listSelectableRanges = selectableRangesByTopLevelList.get(topLevelRangeKey(listRange)) ?? [];

    const completeListSelected =
      listSelectableRanges.length > 1
      && listSelectableRanges.every((range) => selectedKeys.has(rangeKey(range)));

    if (!completeListSelected) {
      output.push(block);
      index += 1;
      continue;
    }

    output.push(listRange);
    index += listSelectableRanges.length;
  }

  return normalizeBlockRanges(output);
}
