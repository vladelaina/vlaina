import type { EditorState } from '@milkdown/kit/prose/state';
import type { Serializer } from '@milkdown/kit/transformer';
import { serializeSliceToText } from '../clipboard/serializer';
import {
  isVisiblePlainTextNode,
  isVisiblePlainTextSlice,
  serializeSliceAsVisiblePlainText,
} from '../clipboard/visibleTextSerialization';
import { normalizeSerializedMarkdownBlock } from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeLeadingFrontmatterMarkdown } from '../frontmatter/frontmatterMarkdown';
import { normalizeBlockRanges, pruneContainedBlockRanges, type BlockRange } from './blockSelectionUtils';
import { collectSelectableBlockRanges } from './blockUnitResolver';
import { LIST_CONTAINER_NODE_NAMES } from '../shared/blockNodeTypes';

interface SerializeSelectedBlocksOptions {
  markdownSerializer?: Serializer | null;
}

const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])(?:\s+(?:\[(?: |x|X)\]\s+)?|$)/;
const ORDERED_LIST_ITEM_MARKER_PATTERN = /^(\s*)(\d+)([.)])(\s+(?:\[(?: |x|X)\]\s+)?|(?=$))/;
const FENCED_CODE_MARKER_PATTERN = /^([ \t]*)(`{3,}|~{3,})/;
const FENCED_CODE_CLOSING_PATTERN = /^([ \t]*)(`{3,}|~{3,})[ \t]*$/;

function getNodeChildren(node: any): any[] {
  const children: any[] = [];
  node?.content?.forEach?.((child: any) => {
    children.push(child);
  });
  return children;
}

function resolveTopLevelBlockInfo(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number; name: string } | null {
  let resolved: { from: number; to: number; name: string } | null = null;

  doc.forEach((node, offset) => {
    if (resolved) return;
    const from = offset;
    const to = offset + node.nodeSize;
    if (pos < from || pos >= to) return;
    resolved = { from, to, name: node.type.name };
  });

  return resolved;
}

function resolveContainingListContainerInfo(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number; name: string } | null {
  try {
    const safePos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(safePos);

    for (let depth = $pos.depth; depth >= 0; depth -= 1) {
      const node = $pos.node(depth);
      if (!isListContainerName(node.type.name)) continue;

      return {
        from: depth === 0 ? 0 : $pos.before(depth),
        to: depth === 0 ? doc.content.size : $pos.after(depth),
        name: node.type.name,
      };
    }

    const nodeAfter = $pos.nodeAfter;
    if (nodeAfter && isListContainerName(nodeAfter.type.name)) {
      return {
        from: safePos,
        to: safePos + nodeAfter.nodeSize,
        name: nodeAfter.type.name,
      };
    }
  } catch {
  }

  return null;
}

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

function renumberOrderedListMarker(text: string, number: number): string {
  return text.replace(
    ORDERED_LIST_ITEM_MARKER_PATTERN,
    (_match, indent: string, _oldNumber: string, delimiter: string, suffix: string) =>
      `${indent}${number}${delimiter}${suffix}`
  );
}

function resolveOrderedListItemNumber(
  doc: EditorState['doc'],
  pos: number,
): number | null {
  const listContainer = resolveContainingListContainerInfo(doc, pos);
  const listItem = resolveContainingListItemInfo(doc, pos);
  if (!listContainer || listContainer.name !== 'ordered_list' || !listItem) return null;

  try {
    const listNode = doc.resolve(listContainer.from).nodeAfter;
    if (!listNode || listNode.type.name !== 'ordered_list') return null;

    const start = Number(listNode.attrs?.order) || 1;
    let index = 0;
    let foundIndex: number | null = null;
    listNode.forEach((child: any, offset: number) => {
      if (foundIndex !== null || child?.type?.name !== 'list_item') return;
      const childFrom = listContainer.from + 1 + offset;
      if (childFrom === listItem.from) {
        foundIndex = index;
        return;
      }
      index += 1;
    });

    return foundIndex === null ? null : start + foundIndex;
  } catch {
    return null;
  }
}

function resolveListItemNodeAtRangeStart(
  state: EditorState,
  range: BlockRange,
): any | null {
  try {
    const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
    const node = state.doc.resolve(safeFrom).nodeAfter;
    return node?.type?.name === 'list_item' ? node : null;
  } catch {
    return null;
  }
}

function resolveContainingListItemAtRange(
  state: EditorState,
  range: BlockRange,
): any | null {
  try {
    const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
    const $from = state.doc.resolve(safeFrom);

    if ($from.nodeAfter?.type?.name === 'list_item') {
      return $from.nodeAfter;
    }

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'list_item') {
        continue;
      }

      const nodeFrom = $from.before(depth);
      if (nodeFrom <= safeFrom) {
        return node;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function resolveContainingListItemInfo(
  doc: EditorState['doc'],
  pos: number,
): { from: number; to: number } | null {
  try {
    const safePos = Math.max(0, Math.min(pos, doc.content.size));
    const $pos = doc.resolve(safePos);

    if ($pos.nodeAfter?.type?.name === 'list_item') {
      return { from: safePos, to: safePos + $pos.nodeAfter.nodeSize };
    }

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (node.type.name !== 'list_item') continue;
      return { from: $pos.before(depth), to: $pos.after(depth) };
    }
  } catch {
  }

  return null;
}

function stripSingleListBlockMarker(text: string): string {
  const lines = text.split('\n');
  let firstLine = lines[0] ?? '';
  let previous = '';
  while (firstLine !== previous) {
    previous = firstLine;
    firstLine = firstLine.replace(LIST_ITEM_MARKER_PATTERN, '');
  }
  lines[0] = firstLine;
  return lines.join('\n');
}

function stripOuterListBlockMarkers(text: string): string {
  const lines = text.split('\n');
  let firstLine = lines[0] ?? '';

  while (LIST_ITEM_MARKER_PATTERN.test(firstLine)) {
    const withoutOuterMarker = firstLine.replace(LIST_ITEM_MARKER_PATTERN, '');
    if (withoutOuterMarker === firstLine || !LIST_ITEM_MARKER_PATTERN.test(withoutOuterMarker)) {
      break;
    }
    firstLine = withoutOuterMarker;
  }

  lines[0] = firstLine;
  return lines.join('\n');
}

function isNestedListRange(state: EditorState, range: BlockRange): boolean {
  try {
    if (typeof state.doc?.forEach !== 'function' || typeof state.doc?.resolve !== 'function') {
      return false;
    }
    const topLevel = resolveTopLevelBlockInfo(state.doc, range.from);
    const listContainer = resolveContainingListContainerInfo(state.doc, range.from);
    return Boolean(
      topLevel
      && listContainer
      && isListContainerName(topLevel.name)
      && (topLevel.from !== listContainer.from || topLevel.to !== listContainer.to)
    );
  } catch {
    return false;
  }
}

function isWholeListContainerRange(state: EditorState, range: BlockRange): boolean {
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

function isWholeListItemRange(state: EditorState, range: BlockRange): boolean {
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

function stripLineIndent(line: string, indent: string): string {
  return indent.length > 0 && line.startsWith(indent)
    ? line.slice(indent.length)
    : line;
}

function normalizeSelectedFencedCodeIndent(text: string): string {
  const lines = text.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const opening = FENCED_CODE_MARKER_PATTERN.exec(lines[index] ?? '');
    if (!opening) continue;

    const openingIndent = opening[1] ?? '';
    const marker = opening[2] ?? '';
    const markerChar = marker[0];
    if (!markerChar) continue;

    let closingIndex = -1;
    let closingIndent = '';
    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      const closingLine = lines[candidate] ?? '';
      const closing = FENCED_CODE_CLOSING_PATTERN.exec(closingLine);
      if (!closing) continue;
      const closingMarker = closing[2] ?? '';
      if (closingMarker[0] !== markerChar || closingMarker.length < marker.length) continue;
      closingIndex = candidate;
      closingIndent = closing[1] ?? '';
      break;
    }

    if (closingIndex === -1) continue;

    const indentToStrip = openingIndent || closingIndent;
    if (indentToStrip.length > 0) {
      for (let lineIndex = index; lineIndex <= closingIndex; lineIndex += 1) {
        lines[lineIndex] = stripLineIndent(lines[lineIndex] ?? '', indentToStrip);
      }
    }

    index = closingIndex;
  }

  return lines.join('\n');
}

function stripCommonContinuationIndent(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= 1) return text;

  let commonIndent: string | null = null;
  for (const line of lines.slice(1)) {
    if (line.length === 0) continue;
    const indent = /^([ \t]*)/.exec(line)?.[1] ?? '';
    if (indent.length === 0) return text;
    commonIndent = commonIndent === null
      ? indent
      : commonIndent.slice(0, commonPrefixLength(commonIndent, indent));
    if (commonIndent.length === 0) return text;
  }

  if (!commonIndent) return text;
  return [
    lines[0] ?? '',
    ...lines.slice(1).map((line) => stripLineIndent(line, commonIndent)),
  ].join('\n');
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function trimLeadingBlankLines(text: string): string {
  const lines = text.split('\n');
  while (lines.length > 1 && (lines[0] ?? '').trim().length === 0) {
    lines.shift();
  }
  return lines.join('\n');
}

function isListItemChildRange(state: EditorState, range: BlockRange): boolean {
  const listItem = resolveContainingListItemInfo(state.doc, range.from);
  return Boolean(
    listItem
    && range.from > listItem.from
    && range.to <= listItem.to
    && !isWholeListItemRange(state, range)
    && !isWholeListContainerRange(state, range)
  );
}

function serializeSingleListBlockWithoutMarker(
  state: EditorState,
  range: BlockRange,
  markdownSerializer?: Serializer | null,
): string | null {
  const directListItem = resolveListItemNodeAtRangeStart(state, range);
  const listItem = directListItem ?? resolveContainingListItemAtRange(state, range);
  if (!listItem || listItem.type.name !== 'list_item') {
    return null;
  }

  const directListItemChildren = getNodeChildren(directListItem);
  if (
    directListItem
    && directListItemChildren.length > 0
    && directListItemChildren.every((child) => child?.type?.name === 'paragraph' && isVisiblePlainTextNode(child))
  ) {
    return normalizeSelectedFencedCodeIndent(
      stripSingleListBlockMarker(
        normalizeSerializedMarkdownBlock(serializeSliceAsVisiblePlainText({ content: directListItem.content }))
      )
    );
  }

  if (markdownSerializer) {
    try {
      const normalized = stripSingleListBlockMarker(
        normalizeSerializedMarkdownBlock(markdownSerializer(state.doc.cut(range.from, range.to)))
      );
      const withoutContinuationIndent = trimLeadingBlankLines(stripCommonContinuationIndent(normalized));
      return normalizeSelectedFencedCodeIndent(withoutContinuationIndent);
    } catch {
    }
  }

  const normalized = stripSingleListBlockMarker(
    normalizeSerializedMarkdownBlock(serializeSliceToText(state.doc.slice(range.from, range.to)))
  );
  const withoutContinuationIndent = trimLeadingBlankLines(stripCommonContinuationIndent(normalized));
  return normalizeSelectedFencedCodeIndent(withoutContinuationIndent);
}

function joinSerializedBlockRanges(
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

function serializePlainParagraphBlock(
  state: EditorState,
  block: BlockRange,
): string | null {
  let blockInfo: { from: number; to: number; name: string } | null = null;
  try {
    blockInfo = resolveTopLevelBlockInfo(state.doc, block.from);
  } catch {
    return null;
  }

  if (!blockInfo || blockInfo.from !== block.from || blockInfo.to !== block.to || blockInfo.name !== 'paragraph') {
    return null;
  }

  const slice = state.doc.slice(block.from, block.to);
  if (!isVisiblePlainTextSlice(slice)) {
    return null;
  }

  return normalizeSerializedMarkdownBlock(serializeSliceAsVisiblePlainText(slice));
}

function normalizeSerializedSelectedBlockMarkdown(
  state: EditorState,
  block: BlockRange,
  text: string,
): string {
  let normalized = isWholeListContainerRange(state, block) || isWholeListItemRange(state, block)
    ? normalizeSerializedMarkdownBlock(text)
    : normalizeSelectedFencedCodeIndent(normalizeSerializedMarkdownBlock(text));
  normalized = isListItemChildRange(state, block)
    ? stripCommonContinuationIndent(normalized)
    : normalized;
  normalized = isNestedListRange(state, block) ? stripOuterListBlockMarkers(normalized) : normalized;

  const orderedNumber = resolveOrderedListItemNumber(state.doc, block.from);
  if (orderedNumber !== null && ORDERED_LIST_ITEM_MARKER_PATTERN.test(normalized)) {
    return renumberOrderedListMarker(normalized, orderedNumber);
  }

  return normalized;
}

function rangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

function collapseCompleteSelectedListContainers(
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
    const listSelectableRanges = allSelectableRanges
      .filter((range) => range.from >= topLevel.from && range.to <= topLevel.to);

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

export function serializeSelectedBlocksToText(
  state: EditorState,
  blocks: readonly BlockRange[],
  options: SerializeSelectedBlocksOptions = {},
): string {
  const normalized = collapseCompleteSelectedListContainers(
    state.doc,
    normalizeBlockRanges(blocks),
  );
  const pruned = pruneContainedBlockRanges(normalized);
  if (pruned.length === 0) return '';

  if (pruned.length === 1 && normalized.length === 1) {
    const singleListText = serializeSingleListBlockWithoutMarker(
      state,
      pruned[0],
      options.markdownSerializer,
    );
    if (singleListText !== null) {
      return serializeLeadingFrontmatterMarkdown(singleListText);
    }
  }

  const { markdownSerializer } = options;
  if (markdownSerializer) {
    try {
      const markdownPieces = pruned
        .map((block) => {
          const plainParagraphText = serializePlainParagraphBlock(state, block);
          if (plainParagraphText !== null) {
            return plainParagraphText;
          }

          return normalizeSerializedSelectedBlockMarkdown(
            state,
            block,
            markdownSerializer(state.doc.cut(block.from, block.to))
          );
        });
      return serializeLeadingFrontmatterMarkdown(
        joinSerializedBlockRanges(state.doc, pruned, markdownPieces)
      );
    } catch {
    }
  }

  const pieces = pruned
    .map((block) => normalizeSerializedSelectedBlockMarkdown(
      state,
      block,
      serializeSliceToText(state.doc.slice(block.from, block.to))
    ));

  return serializeLeadingFrontmatterMarkdown(
    joinSerializedBlockRanges(state.doc, pruned, pieces)
  );
}
