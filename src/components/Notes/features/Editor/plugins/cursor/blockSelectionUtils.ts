import type { EditorState, Transaction } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { COMPLEX_LIST_ITEM_CHILD_NODE_NAMES } from '../shared/blockNodeTypes';

export interface RectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BlockRect extends RectBounds {
  from: number;
  to: number;
  contentLeft?: number;
  contentRight?: number;
  contentLineRects?: RectBounds[];
  allowInsideTrailingClick?: boolean;
}

export interface BlockRange {
  from: number;
  to: number;
}

export interface BlockRectYIndex {
  blocks: readonly BlockRect[];
  sortedByTop: readonly BlockRect[];
}

export const LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD = 128;
const LARGE_BLOCK_SELECTION_DECORATION_CLASS = 'editor-block-selected md-focus editor-block-selected-large-item';
const LARGE_TEXTLIKE_BLOCK_SELECTION_DECORATION_CLASS = `${LARGE_BLOCK_SELECTION_DECORATION_CLASS} editor-block-selected-large-textlike`;
const LARGE_RICH_BLOCK_SELECTION_DECORATION_CLASS = `${LARGE_BLOCK_SELECTION_DECORATION_CLASS} editor-block-selected-large-rich`;

export function createDragSelectionRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): RectBounds {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY),
  };
}

function isAxisIntersecting(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  const aSize = aEnd - aStart;
  const bSize = bEnd - bStart;

  if (aSize === 0 && bSize === 0) {
    return false;
  }
  if (aSize === 0) {
    return aStart > bStart && aStart < bEnd;
  }
  if (bSize === 0) {
    return bStart > aStart && bStart < aEnd;
  }
  return aEnd > bStart && aStart < bEnd;
}

export function isRectIntersecting(a: RectBounds, b: RectBounds): boolean {
  return (
    isAxisIntersecting(a.left, a.right, b.left, b.right) &&
    isAxisIntersecting(a.top, a.bottom, b.top, b.bottom)
  );
}

export function normalizeBlockRanges(ranges: readonly BlockRange[]): BlockRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges]
    .filter((range) => range.to > range.from)
    .sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));

  const unique: BlockRange[] = [];
  let lastFrom = -1;
  let lastTo = -1;
  for (const range of sorted) {
    if (range.from === lastFrom && range.to === lastTo) continue;
    unique.push(range);
    lastFrom = range.from;
    lastTo = range.to;
  }
  return unique;
}

export function getBlockRangeKey(from: number, to: number): string {
  return `${from}:${to}`;
}

export function pruneContainedBlockRanges(ranges: readonly BlockRange[]): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length <= 1) return normalized;

  const sorted = [...normalized].sort((a, b) => (
    a.from === b.from ? b.to - a.to : a.from - b.from
  ));

  const pruned: BlockRange[] = [];
  for (const range of sorted) {
    const previous = pruned[pruned.length - 1];
    if (previous && range.from >= previous.from && range.to <= previous.to) {
      continue;
    }
    pruned.push(range);
  }

  return pruned.sort((a, b) => (a.from === b.from ? a.to - b.to : a.from - b.from));
}

export function resolveIntersectedBlockRanges(
  blocks: readonly BlockRect[],
  selectionRect: RectBounds,
): BlockRange[] {
  const selected = blocks
    .filter((block) => isRectIntersecting(block, selectionRect))
    .map((block) => ({ from: block.from, to: block.to }));

  return normalizeBlockRanges(selected);
}

function findFirstBlockWithTopAtOrAfter(blocks: readonly BlockRect[], top: number): number {
  let low = 0;
  let high = blocks.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (blocks[mid].top < top) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function createBlockRectYIndex(blocks: readonly BlockRect[]): BlockRectYIndex {
  return {
    blocks,
    sortedByTop: [...blocks].sort((left, right) => (
      left.top === right.top ? left.bottom - right.bottom : left.top - right.top
    )),
  };
}

export function resolveIntersectedBlockRangesFromYIndex(
  index: BlockRectYIndex,
  selectionRect: RectBounds,
): BlockRange[] {
  if (index.blocks.length === 0) return [];

  const maybeIntersectingEnd = findFirstBlockWithTopAtOrAfter(index.sortedByTop, selectionRect.bottom);
  const selected: BlockRange[] = [];

  for (let i = 0; i < maybeIntersectingEnd; i += 1) {
    const block = index.sortedByTop[i];
    if (block.bottom <= selectionRect.top) continue;
    if (!isRectIntersecting(block, selectionRect)) continue;
    selected.push({ from: block.from, to: block.to });
  }

  return normalizeBlockRanges(selected);
}

export function preferNestedBlockRanges(ranges: readonly BlockRange[]): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  if (normalized.length <= 1) return normalized;

  const deepestFirst = [...normalized].sort((left, right) => (
    left.from === right.from ? left.to - right.to : right.from - left.from
  ));
  const kept: BlockRange[] = [];
  let minNestedTo = Number.POSITIVE_INFINITY;

  for (const range of deepestFirst) {
    if (minNestedTo <= range.to) {
      continue;
    }
    kept.push(range);
    minNestedTo = Math.min(minNestedTo, range.to);
  }

  return normalizeBlockRanges(kept);
}

function findFirstRangeStartingAfter(ranges: readonly BlockRange[], from: number): number {
  let low = 0;
  let high = ranges.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (ranges[mid].from <= from) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

export function preferNestedBlockRangesUnlessHeaderIntersects(
  ranges: readonly BlockRange[],
  blocks: readonly BlockRect[],
  selectionRect: RectBounds,
): BlockRange[] {
  const normalized = normalizeBlockRanges(ranges);
  const nestedPreferred = preferNestedBlockRanges(normalized);
  if (nestedPreferred.length === normalized.length) return nestedPreferred;

  const nestedKeys = new Set(nestedPreferred.map((range) => getBlockRangeKey(range.from, range.to)));
  const candidateParents = normalized.filter((range) => !nestedKeys.has(getBlockRangeKey(range.from, range.to)));
  const selectedChildren = nestedPreferred.sort((left, right) => (
    left.from === right.from ? left.to - right.to : left.from - right.from
  ));
  const blockTopByRange = new Map(blocks.map((block) => [getBlockRangeKey(block.from, block.to), block.top]));

  const preservedParents: BlockRange[] = [];
  for (const parent of candidateParents) {
    let firstChildTop: number | null = null;
    const startIndex = findFirstRangeStartingAfter(selectedChildren, parent.from);
    for (let index = startIndex; index < selectedChildren.length; index += 1) {
      const child = selectedChildren[index];
      if (child.from >= parent.to) break;
      if (child.to > parent.to) continue;

      const childTop = blockTopByRange.get(getBlockRangeKey(child.from, child.to));
      if (childTop === undefined) continue;
      firstChildTop = firstChildTop === null ? childTop : Math.min(firstChildTop, childTop);
    }

    if (firstChildTop !== null && selectionRect.top < firstChildTop) {
      preservedParents.push(parent);
    }
  }

  return preservedParents.length > 0
    ? pruneContainedBlockRanges([...nestedPreferred, ...preservedParents])
    : nestedPreferred;
}

export function getBlockRangesKey(ranges: readonly BlockRange[]): string {
  if (ranges.length === 0) return '';
  return ranges.map((range) => `${range.from}:${range.to}`).join('|');
}

export function resolveStandaloneImageBlockRange(
  doc: EditorState['doc'],
  block: BlockRange,
): BlockRange | null {
  const safeFrom = Math.max(0, Math.min(block.from, doc.content.size));
  const safeTo = Math.max(0, Math.min(block.to, doc.content.size));

  try {
    const $from = doc.resolve(safeFrom);
    const nodeAfter = $from.nodeAfter;
    if (!nodeAfter || nodeAfter.type.name !== 'paragraph') return null;
    if (safeTo !== safeFrom + nodeAfter.nodeSize) return null;
    if (nodeAfter.childCount !== 1 || nodeAfter.firstChild?.type.name !== 'image') return null;

    const imageFrom = safeFrom + 1;
    return {
      from: imageFrom,
      to: imageFrom + nodeAfter.firstChild.nodeSize,
    };
  } catch {
    return null;
  }
}

export function getDisplayBlockRangesForDecorations(
  doc: EditorState['doc'],
  blocks: readonly BlockRange[],
): BlockRange[] {
  const result = normalizeBlockRanges(blocks.map((block) => {
    const safeFrom = Math.max(0, Math.min(block.from, doc.content.size));
    let from = block.from;
    let to = block.to;

    try {
      const $from = doc.resolve(safeFrom);
      const nodeAfter = $from.nodeAfter;
      if (nodeAfter?.type.name === 'list_item' && to > from) {
        from = safeFrom;
        to = safeFrom + nodeAfter.nodeSize;
      } else {
        const imageRange = resolveStandaloneImageBlockRange(doc, block);
        if (imageRange) {
          from = imageRange.from;
          to = imageRange.to;
        }
      }
    } catch {
    }

    return { from, to };
  }));
  return result;
}

interface ContainedListChildSelection {
  itemFrom: number;
  itemTo: number;
}

interface BlockSelectionDecorationContext {
  displayRangeKeys: ReadonlySet<string>;
  hasNextDisplayRangeKeys: ReadonlySet<string>;
  hasPreviousDisplayRangeKeys: ReadonlySet<string>;
}

const RICH_BLOCK_SELECTION_NODE_NAMES = new Set([
  'code_block',
  'frontmatter',
  'image',
  'math_block',
  'mermaid',
  'table',
  'video',
]);
const NON_RICH_HTML_BLOCK_VALUES = new Set([
  '<!--vlaina-markdown-blank-line-->',
  '<!--vlaina-markdown-tight-heading-->',
]);
const NON_RENDERING_HTML_COMMENT_PATTERN = /^<!--(?:(?!-->)[\s\S])*-->$/;
const NON_RENDERING_HTML_PROCESSING_INSTRUCTION_PATTERN = /^<\?(?:(?!\?>)[\s\S])*\?>$/;
const NON_RENDERING_HTML_DECLARATION_PATTERN = /^<![A-Za-z][^>]*>$/;
const NON_RENDERING_HTML_CDATA_PATTERN = /^<!\[CDATA\[(?:(?!\]\]>)[\s\S])*\]\]>$/;

const PARENT_MARKER_SELECTION_NODE_NAMES = new Set([
  'blockquote',
  'list_item',
]);

function nodeHasDirectChildType(node: EditorState['doc'], childTypeName: string): boolean {
  const childCount = typeof node.childCount === 'number' ? node.childCount : 0;
  for (let index = 0; index < childCount; index += 1) {
    if (node.child(index)?.type.name === childTypeName) {
      return true;
    }
  }
  return false;
}

function getBlockSelectionStructuralClass(
  doc: EditorState['doc'],
  range: BlockRange,
  isNodeRange: boolean,
): string {
  if (!isNodeRange) return '';

  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  try {
    const nodeAfter = doc.resolve(safeFrom).nodeAfter;
    if (!nodeAfter) return '';
    if (nodeAfter.type.name === 'hr') {
      return 'editor-block-selected-hr-wrapper';
    }
    if (nodeAfter.type.name === 'list_item' && nodeHasDirectChildType(nodeAfter, 'code_block')) {
      return 'editor-block-selected-has-direct-code-block';
    }
    if (nodeAfter.type.name === 'paragraph' && nodeHasDirectChildType(nodeAfter, 'image')) {
      return 'editor-block-selected-has-direct-image';
    }
  } catch {
  }

  return '';
}

function resolveContainedListChildSelection(
  doc: EditorState['doc'],
  range: BlockRange,
): ContainedListChildSelection | null {
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));

  try {
    const $from = doc.resolve(safeFrom);
    const nodeAfter = $from.nodeAfter;
    if (!nodeAfter || !COMPLEX_LIST_ITEM_CHILD_NODE_NAMES.has(nodeAfter.type.name)) {
      return null;
    }

    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'list_item') continue;

      const itemFrom = $from.before(depth);
      return {
        itemFrom,
        itemTo: itemFrom + node.nodeSize,
      };
    }
  } catch {
  }

  return null;
}

export function getBlockSelectionDecorationClass(
  doc: EditorState['doc'],
  range: BlockRange,
  displayRanges: readonly BlockRange[],
  context?: BlockSelectionDecorationContext,
): string {
  const containedSelection = resolveContainedListChildSelection(doc, range);
  if (!containedSelection) return 'editor-block-selected md-focus';

  const selectedContainerKey = getBlockRangeKey(containedSelection.itemFrom, containedSelection.itemTo);
  const hasSelectedContainer = context
    ? context.displayRangeKeys.has(selectedContainerKey)
    : displayRanges.some((candidate) => getBlockRangeKey(candidate.from, candidate.to) === selectedContainerKey);

  return hasSelectedContainer
    ? 'editor-block-selected md-focus editor-block-selected-contained'
    : 'editor-block-selected md-focus';
}

function isNodeDecorationRange(doc: EditorState['doc'], range: BlockRange): boolean {
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  try {
    const nodeAfter = doc.resolve(safeFrom).nodeAfter;
    return Boolean(nodeAfter && !nodeAfter.isText && safeFrom + nodeAfter.nodeSize === range.to);
  } catch {
    return false;
  }
}

function resolveParentMarkerDecorationRanges(
  doc: EditorState['doc'],
  range: BlockRange,
  selectedRangeKeys: ReadonlySet<string>,
): BlockRange[] {
  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  const result: BlockRange[] = [];

  try {
    const $from = doc.resolve(safeFrom);
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (!PARENT_MARKER_SELECTION_NODE_NAMES.has(node.type.name)) {
        continue;
      }
      if (node.type.name === 'list_item' && !isListItemHeadSelection(node, $from.before(depth), range)) {
        continue;
      }

      const from = $from.before(depth);
      const to = from + node.nodeSize;
      if (selectedRangeKeys.has(getBlockRangeKey(from, to))) {
        continue;
      }
      result.push({ from, to });
    }
  } catch {
  }

  return result;
}

function isListItemHeadSelection(
  listItem: EditorState['doc'],
  itemFrom: number,
  range: BlockRange,
): boolean {
  const firstChild = listItem.firstChild;
  if (!firstChild) return false;

  const firstChildFrom = itemFrom + 1;
  const firstChildTo = firstChildFrom + firstChild.nodeSize;
  return range.from >= firstChildFrom && range.from < firstChildTo;
}

function isTextLikeDecorationRange(doc: EditorState['doc'], range: BlockRange, isNodeRange: boolean): boolean {
  if (!isNodeRange) return true;

  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  try {
    const nodeAfter = doc.resolve(safeFrom).nodeAfter;
    if (!nodeAfter) return true;
    return !isRichBlockSelectionNode(nodeAfter);
  } catch {
    return true;
  }
}

function isRichBlockSelectionNode(node: EditorState['doc']): boolean {
  if (node.type.name !== 'html_block') {
    return RICH_BLOCK_SELECTION_NODE_NAMES.has(node.type.name);
  }

  const value = typeof node.attrs?.value === 'string'
    ? node.attrs.value
    : node.textContent;
  const trimmed = value.trim();
  if (!trimmed || NON_RICH_HTML_BLOCK_VALUES.has(trimmed)) return false;
  if (NON_RENDERING_HTML_COMMENT_PATTERN.test(trimmed)) return false;
  if (NON_RENDERING_HTML_PROCESSING_INSTRUCTION_PATTERN.test(trimmed)) return false;
  if (NON_RENDERING_HTML_DECLARATION_PATTERN.test(trimmed)) return false;
  if (NON_RENDERING_HTML_CDATA_PATTERN.test(trimmed)) return false;
  return true;
}

function isHardBreakNodeName(name: string): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

function trimTrailingHardBreakFromInlineRange(
  doc: EditorState['doc'],
  range: BlockRange,
): BlockRange | null {
  const safeTo = Math.max(0, Math.min(range.to, doc.content.size));
  if (safeTo <= range.from) return range;

  try {
    const nodeBefore = doc.resolve(safeTo).nodeBefore;
    if (!nodeBefore || !isHardBreakNodeName(nodeBefore.type.name)) {
      return range;
    }

    const to = safeTo - nodeBefore.nodeSize;
    if (to <= range.from) return null;
    return { from: range.from, to };
  } catch {
    return range;
  }
}

function isPartialParagraphRange(doc: EditorState['doc'], range: BlockRange): boolean {
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

export function createBlockSelectionDecorations(doc: EditorState['doc'], blocks: readonly BlockRange[]): DecorationSet {
  if (blocks.length === 0) return DecorationSet.empty;

  const displayRanges = getDisplayBlockRangesForDecorations(doc, blocks);
  const useLargeSelectionRendering = displayRanges.length >= LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD;
  const displayRangeKeys = new Set(displayRanges.map((range) => getBlockRangeKey(range.from, range.to)));
  const hasNextDisplayRangeKeys = new Set<string>();
  const hasPreviousDisplayRangeKeys = new Set<string>();
  for (let index = 0; index < displayRanges.length - 1; index += 1) {
    const current = displayRanges[index];
    const next = displayRanges[index + 1];
    if (!current || !next || !areBlockSelectionDisplayRangesVisuallyAdjacent(doc, current, next)) continue;
    hasNextDisplayRangeKeys.add(getBlockRangeKey(current.from, current.to));
    hasPreviousDisplayRangeKeys.add(getBlockRangeKey(next.from, next.to));
  }
  const context: BlockSelectionDecorationContext = {
    displayRangeKeys,
    hasNextDisplayRangeKeys,
    hasPreviousDisplayRangeKeys,
  };
  const parentMarkerDecorations = new Map<string, Decoration>();

  const addParentMarkerDecorations = (range: BlockRange) => {
    if (useLargeSelectionRendering) return;
    for (const parentRange of resolveParentMarkerDecorationRanges(doc, range, displayRangeKeys)) {
      parentMarkerDecorations.set(
        getBlockRangeKey(parentRange.from, parentRange.to),
        Decoration.node(parentRange.from, parentRange.to, { class: 'editor-block-selected-parent-marker' }),
      );
    }
  };

  const decorations = displayRanges.flatMap((range) => {
    const isNodeRange = isNodeDecorationRange(doc, range);
    const isInlineLineSelection = !isNodeRange && isPartialParagraphRange(doc, range);
    if (useLargeSelectionRendering) {
      const rangeKey = getBlockRangeKey(range.from, range.to);
      const structuralClass = getBlockSelectionStructuralClass(doc, range, isNodeRange);
      const className = [
        isTextLikeDecorationRange(doc, range, isNodeRange)
          ? LARGE_TEXTLIKE_BLOCK_SELECTION_DECORATION_CLASS
          : LARGE_RICH_BLOCK_SELECTION_DECORATION_CLASS,
        structuralClass,
        context.hasNextDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-next' : '',
        context.hasPreviousDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-previous' : '',
        isInlineLineSelection ? 'editor-block-selected-inline-line' : '',
      ].filter(Boolean).join(' ');
      if (isNodeRange) {
        return [Decoration.node(range.from, range.to, { class: className })];
      }
      const inlineRange = trimTrailingHardBreakFromInlineRange(doc, range);
      return inlineRange ? [Decoration.inline(inlineRange.from, inlineRange.to, {
        class: className,
      })] : [];
    }

    const rangeKey = getBlockRangeKey(range.from, range.to);
    const isTextLikeSelection = isTextLikeDecorationRange(doc, range, isNodeRange);
    const structuralClass = getBlockSelectionStructuralClass(doc, range, isNodeRange);
    const attrs = {
      class: [
        getBlockSelectionDecorationClass(doc, range, displayRanges, context),
        isTextLikeSelection ? 'editor-block-selected-textlike' : '',
        structuralClass,
        context.hasNextDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-next' : '',
        context.hasPreviousDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-previous' : '',
        isInlineLineSelection ? 'editor-block-selected-inline-line' : '',
      ].filter(Boolean).join(' '),
    };
    if (isNodeRange) {
      addParentMarkerDecorations(range);
      return [Decoration.node(range.from, range.to, attrs)];
    }

    const inlineRange = trimTrailingHardBreakFromInlineRange(doc, range);
    if (!inlineRange) return [];

    addParentMarkerDecorations(range);
    return [Decoration.inline(inlineRange.from, inlineRange.to, attrs)];
  });

  return DecorationSet.create(doc, [
    ...decorations,
    ...parentMarkerDecorations.values(),
  ]);
}

export function mapBlockRangesThroughTransaction(blocks: readonly BlockRange[], tr: Transaction): BlockRange[] {
  if (blocks.length === 0) return [];

  const mapped = blocks
    .map((block) => ({
      from: tr.mapping.map(block.from, 1),
      to: tr.mapping.map(block.to, -1),
    }))
    .filter((block) => block.to > block.from);

  return normalizeBlockRanges(mapped);
}

function resolveDragPointerCoordinate(start: number, min: number, max: number): number {
  return start === min ? max : min;
}

export function convertViewportDragRectToDocumentRect(
  viewportRect: RectBounds,
  startX: number,
  startY: number,
  startScrollLeft: number,
  startScrollTop: number,
  currentScrollLeft: number,
  currentScrollTop: number,
): RectBounds {
  const currentX = resolveDragPointerCoordinate(startX, viewportRect.left, viewportRect.right);
  const currentY = resolveDragPointerCoordinate(startY, viewportRect.top, viewportRect.bottom);
  const startDocX = startX + startScrollLeft;
  const startDocY = startY + startScrollTop;
  const currentDocX = currentX + currentScrollLeft;
  const currentDocY = currentY + currentScrollTop;
  return createDragSelectionRect(startDocX, startDocY, currentDocX, currentDocY);
}

export function convertDocumentRectToViewportRect(
  documentRect: RectBounds,
  currentScrollLeft: number,
  currentScrollTop: number,
): RectBounds {
  return {
    left: documentRect.left - currentScrollLeft,
    right: documentRect.right - currentScrollLeft,
    top: documentRect.top - currentScrollTop,
    bottom: documentRect.bottom - currentScrollTop,
  };
}

export function resolveDisplayedDragViewportRect(
  rawViewportRect: RectBounds,
  startX: number,
  startY: number,
  startScrollLeft: number,
  startScrollTop: number,
  currentScrollLeft: number,
  currentScrollTop: number,
): RectBounds {
  const documentRect = convertViewportDragRectToDocumentRect(
    rawViewportRect,
    startX,
    startY,
    startScrollLeft,
    startScrollTop,
    currentScrollLeft,
    currentScrollTop,
  );

  return convertDocumentRectToViewportRect(documentRect, currentScrollLeft, currentScrollTop);
}

export function clampViewportRectTop(rect: RectBounds, minTop: number): RectBounds {
  if (rect.top >= minTop) return rect;

  return {
    ...rect,
    top: minTop,
    bottom: Math.max(rect.bottom, minTop),
  };
}

export function convertBlockRectsToDocumentSpace(
  blockRects: readonly BlockRect[],
  scrollLeft: number,
  scrollTop: number,
): BlockRect[] {
  if (scrollLeft === 0 && scrollTop === 0) {
    return [...blockRects];
  }

  return blockRects.map((block) => ({
    ...block,
    left: block.left + scrollLeft,
    right: block.right + scrollLeft,
    ...(block.contentLeft === undefined ? {} : { contentLeft: block.contentLeft + scrollLeft }),
    ...(block.contentRight === undefined ? {} : { contentRight: block.contentRight + scrollLeft }),
    top: block.top + scrollTop,
    bottom: block.bottom + scrollTop,
  }));
}
