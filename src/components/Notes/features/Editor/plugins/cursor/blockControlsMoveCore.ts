import { Fragment } from '@milkdown/kit/prose/model';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { pruneContainedBlockRanges, type BlockRange } from './blockSelectionUtils';
import { createBlockMovePlan } from './blockControlsUtils';
import {
  buildDeleteRangesFromSelectedListItems,
  collectSelectedListItemInfo,
  getRangeKey,
  isListContainerName,
  type LiftedListGroup,
  type SelectedListItemInfo,
} from './listBlockUtils';

interface WrappedListBuffer {
  type: SelectedListItemInfo['parentType'];
  attrs: SelectedListItemInfo['parentAttrs'];
  items: Array<SelectedListItemInfo['moveItemNode']>;
}

export interface BlockMoveContext {
  selectedRanges: BlockRange[];
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>;
  deleteRanges: BlockRange[];
  targetPos: number;
}

export interface PreparedBlockMove {
  tr: EditorView['state']['tr'];
  targetPos: number;
  movedContent: Fragment;
}

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';

function areNodeAttrsEqual(
  a: SelectedListItemInfo['parentAttrs'],
  b: SelectedListItemInfo['parentAttrs'],
): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function isInsertPosInsideRanges(insertPos: number, ranges: readonly BlockRange[]): boolean {
  return ranges.some((range) => insertPos >= range.from && insertPos <= range.to);
}

function resolveAdjustedTargetPos(insertPos: number, deleteRanges: readonly BlockRange[]): number {
  const deletedBeforeInsert = deleteRanges.reduce((total, range) => (
    range.to <= insertPos ? total + (range.to - range.from) : total
  ), 0);
  return insertPos - deletedBeforeInsert;
}

function isRemovableMarkdownBlankLineNode(node: ProseNode | null | undefined): boolean {
  if (!node) return false;
  if (node.type.name === 'html_block' && node.attrs?.value === MARKDOWN_BLANK_LINE_VALUE) {
    return true;
  }
  if (node.type.name !== 'paragraph') {
    return false;
  }
  if (node.content.size === 0) {
    return true;
  }
  return (
    node.content.size === EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length &&
    node.textBetween(0, EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER.length, '\0', '\0') ===
      EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER
  );
}

function expandMovedFrontmatterDeleteRanges(
  doc: EditorView['state']['doc'],
  selectedRanges: readonly BlockRange[],
  deleteRanges: readonly BlockRange[],
  insertPos: number,
): BlockRange[] {
  if (insertPos === 0) return [...deleteRanges];

  const expanded = [...deleteRanges];
  for (const range of selectedRanges) {
    if (range.from !== 0) continue;
    const frontmatterNode = doc.nodeAt(range.from);
    if (!frontmatterNode || frontmatterNode.type.name !== 'frontmatter') continue;

    const separator = doc.nodeAt(range.to);
    if (!separator || !isRemovableMarkdownBlankLineNode(separator)) continue;
    expanded.push({ from: range.to, to: range.to + separator.nodeSize });
    break;
  }

  return pruneContainedBlockRanges(expanded);
}

function findTopLevelBlankLineBefore(
  doc: EditorView['state']['doc'],
  pos: number,
): BlockRange | null {
  let result: BlockRange | null = null;
  doc.forEach((node, offset) => {
    if (result) return;
    const to = offset + node.nodeSize;
    if (to !== pos || !isRemovableMarkdownBlankLineNode(node)) return;
    result = { from: offset, to };
  });
  return result;
}

function findTopLevelBlankLineAfter(
  doc: EditorView['state']['doc'],
  pos: number,
): BlockRange | null {
  let result: BlockRange | null = null;
  doc.forEach((node, offset) => {
    if (result || offset !== pos || !isRemovableMarkdownBlankLineNode(node)) return;
    result = { from: offset, to: offset + node.nodeSize };
  });
  return result;
}

function isTopLevelBlankLineRange(
  doc: EditorView['state']['doc'],
  range: BlockRange,
): boolean {
  let result = false;
  doc.forEach((node, offset) => {
    if (result || offset !== range.from) return;
    result = offset + node.nodeSize === range.to && isRemovableMarkdownBlankLineNode(node);
  });
  return result;
}

function hasMovedNonBlankContent(
  doc: EditorView['state']['doc'],
  selectedRanges: readonly BlockRange[],
): boolean {
  return selectedRanges.some((range) => !isTopLevelBlankLineRange(doc, range));
}

function hasTopLevelNonBlankBlockBefore(
  doc: EditorView['state']['doc'],
  pos: number,
): boolean {
  let result = false;
  doc.forEach((node, offset) => {
    if (result) return;
    const to = offset + node.nodeSize;
    if (to > pos) return;
    if (!isRemovableMarkdownBlankLineNode(node)) {
      result = true;
    }
  });
  return result;
}

function hasTopLevelNonBlankBlockAfter(
  doc: EditorView['state']['doc'],
  pos: number,
): boolean {
  let result = false;
  doc.forEach((node, offset) => {
    if (result || offset < pos) return;
    if (!isRemovableMarkdownBlankLineNode(node)) {
      result = true;
    }
  });
  return result;
}

function expandMoveDeleteRangesWithAdjacentBlankLines(
  doc: EditorView['state']['doc'],
  selectedRanges: readonly BlockRange[],
  deleteRanges: readonly BlockRange[],
): BlockRange[] {
  if (!hasMovedNonBlankContent(doc, selectedRanges)) return [...deleteRanges];

  const expanded = [...deleteRanges];
  for (const range of selectedRanges) {
    const before = findTopLevelBlankLineBefore(doc, range.from);
    if (before && hasTopLevelNonBlankBlockBefore(doc, before.from)) {
      expanded.push(before);
    }

    const after = findTopLevelBlankLineAfter(doc, range.to);
    if (after && hasTopLevelNonBlankBlockAfter(doc, after.to)) {
      expanded.push(after);
    }
  }

  return pruneContainedBlockRanges(expanded);
}

function removeAdjacentBlankLinesForMoveTarget(
  tr: EditorView['state']['tr'],
  targetPos: number,
): { tr: EditorView['state']['tr']; targetPos: number } {
  let nextTr = tr;
  let nextTargetPos = targetPos;

  const before = findTopLevelBlankLineBefore(nextTr.doc, nextTargetPos);
  if (before && hasTopLevelNonBlankBlockAfter(nextTr.doc, nextTargetPos)) {
    nextTr = nextTr.delete(before.from, before.to);
    nextTargetPos -= before.to - before.from;
  }

  const after = findTopLevelBlankLineAfter(nextTr.doc, nextTargetPos);
  if (after && hasTopLevelNonBlankBlockBefore(nextTr.doc, nextTargetPos)) {
    nextTr = nextTr.delete(after.from, after.to);
  }

  return {
    tr: nextTr,
    targetPos: Math.max(0, Math.min(nextTargetPos, nextTr.doc.content.size)),
  };
}

export function resolveBlockMoveContext(
  view: EditorView,
  selectedRanges: readonly BlockRange[],
  insertPos: number,
): BlockMoveContext | null {
  const movePlan = createBlockMovePlan(pruneContainedBlockRanges(selectedRanges), insertPos);
  if (!movePlan) return null;

  const listItemInfoByRangeKey = collectSelectedListItemInfo(view.state, movePlan.selectedRanges);
  const baseDeleteRanges = expandMovedFrontmatterDeleteRanges(
    view.state.doc,
    movePlan.selectedRanges,
    buildDeleteRangesFromSelectedListItems(movePlan.selectedRanges, listItemInfoByRangeKey),
    insertPos,
  );
  const deleteRanges = expandMoveDeleteRangesWithAdjacentBlankLines(
    view.state.doc,
    movePlan.selectedRanges,
    baseDeleteRanges,
  );
  if (deleteRanges.length === 0) return null;
  if (isInsertPosInsideRanges(insertPos, deleteRanges)) return null;

  const targetPos = resolveAdjustedTargetPos(insertPos, deleteRanges);
  if (targetPos === deleteRanges[0].from) return null;

  return {
    selectedRanges: movePlan.selectedRanges,
    listItemInfoByRangeKey,
    deleteRanges,
    targetPos,
  };
}

function isInsertionInsideList(doc: EditorView['state']['doc'], pos: number): boolean {
  const safePos = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(safePos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!isListContainerName(node.type.name)) continue;
    const nodeFrom = $pos.before(depth);
    const contentFrom = nodeFrom + 1;
    const contentTo = nodeFrom + node.nodeSize - 1;
    if (safePos >= contentFrom && safePos <= contentTo) {
      return true;
    }
  }
  return false;
}

function appendListBuffer(target: Fragment, buffer: WrappedListBuffer | null): Fragment {
  if (!buffer || buffer.items.length === 0) return target;
  const wrappedList = buffer.type.create(buffer.attrs, buffer.items);
  return target.append(Fragment.from(wrappedList));
}

function buildLiftedSourceFragment(groups: readonly LiftedListGroup[], insertInsideList: boolean): Fragment {
  if (groups.length === 0) return Fragment.empty;

  let fragment = Fragment.empty;
  if (insertInsideList) {
    for (const group of groups) {
      for (const item of group.items) {
        fragment = fragment.append(Fragment.from(item.node));
      }
    }
    return fragment;
  }

  for (const group of groups) {
    if (group.items.length === 0) continue;
    const wrappedList = group.type.create(
      group.attrs,
      group.items.map((item) => item.node),
    );
    fragment = fragment.append(Fragment.from(wrappedList));
  }
  return fragment;
}

function createHardBreak(view: EditorView): ProseNode | null {
  const hardBreakType = view.state.schema.nodes.hardbreak ?? view.state.schema.nodes.hard_break;
  return hardBreakType?.create() ?? null;
}

function createPlainTextFragmentFromFrontmatter(view: EditorView, node: ProseNode): Fragment {
  const frontmatterText = node.textContent.replace(/\r\n?/g, '\n');
  const lines = frontmatterText.length > 0 ? frontmatterText.split('\n') : [''];
  const paragraphType = view.state.schema.nodes.paragraph;
  if (!paragraphType) return Fragment.empty;

  const content: ProseNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      const hardBreak = createHardBreak(view);
      if (hardBreak) {
        content.push(hardBreak);
      }
    }
    if (line.length > 0) {
      content.push(view.state.schema.text(line));
    }
  });

  return Fragment.from(paragraphType.create(null, content));
}

export function convertMovedFrontmatterToPlainText(
  view: EditorView,
  content: Fragment,
  targetPos: number,
): Fragment {
  if (targetPos === 0) return content;

  let converted = Fragment.empty;
  content.forEach((child) => {
    converted = converted.append(
      child.type.name === 'frontmatter'
        ? createPlainTextFragmentFromFrontmatter(view, child)
        : Fragment.from(child)
    );
  });
  return converted;
}

function collectSourceResidualInsertions(
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: ReadonlyMap<string, SelectedListItemInfo>,
): Array<{ from: number; groups: LiftedListGroup[] }> {
  if (selectedRanges.length === 0) return [];

  const selectedRangeFromSet = new Set(selectedRanges.map((range) => range.from));
  const insertions: Array<{ from: number; groups: LiftedListGroup[] }> = [];

  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info || info.liftedListGroups.length === 0) continue;

    const groups = info.liftedListGroups
      .map((group) => ({
        type: group.type,
        attrs: group.attrs,
        items: group.items.filter((item) => !selectedRangeFromSet.has(item.from)),
      }))
      .filter((group) => group.items.length > 0);
    if (groups.length === 0) continue;

    insertions.push({
      from: info.range.from,
      groups,
    });
  }

  return insertions;
}

function createSelectedListItemInfoByFrom(
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: ReadonlyMap<string, SelectedListItemInfo>,
): Map<number, SelectedListItemInfo> {
  const selectedInfoByFrom = new Map<number, SelectedListItemInfo>();
  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info) continue;
    selectedInfoByFrom.set(range.from, info);
  }
  return selectedInfoByFrom;
}

function collectNestedSelectedListItemStarts(
  selectedInfoByFrom: ReadonlyMap<number, SelectedListItemInfo>,
): Set<number> {
  const nestedSelectedStarts = new Set<number>();
  for (const info of selectedInfoByFrom.values()) {
    for (const group of info.liftedListGroups) {
      for (const item of group.items) {
        if (!selectedInfoByFrom.has(item.from)) continue;
        nestedSelectedStarts.add(item.from);
      }
    }
  }
  return nestedSelectedStarts;
}

function buildSelectedListItemNode(
  info: SelectedListItemInfo,
  selectedInfoByFrom: ReadonlyMap<number, SelectedListItemInfo>,
  cache: Map<number, ProseNode>,
): ProseNode {
  const cached = cache.get(info.range.from);
  if (cached) return cached;

  const children: ProseNode[] = [];
  info.moveItemNode.forEach((child) => {
    children.push(child);
  });

  for (const group of info.liftedListGroups) {
    const selectedChildNodes = group.items
      .map((item) => selectedInfoByFrom.get(item.from))
      .filter((childInfo): childInfo is SelectedListItemInfo => childInfo !== undefined)
      .map((childInfo) => buildSelectedListItemNode(childInfo, selectedInfoByFrom, cache));

    if (selectedChildNodes.length === 0) continue;
    children.push(group.type.create(group.attrs, selectedChildNodes));
  }

  const nextNode = info.moveItemNode.type.create(info.moveItemNode.attrs, children);
  cache.set(info.range.from, nextNode);
  return nextNode;
}

function buildMovedContent(
  view: EditorView,
  selectedRanges: readonly BlockRange[],
  listItemInfoByRangeKey: Map<string, SelectedListItemInfo>,
  insertInsideList: boolean,
): Fragment {
  let content = Fragment.empty;
  let wrappedListBuffer: WrappedListBuffer | null = null;
  const selectedInfoByFrom = createSelectedListItemInfoByFrom(selectedRanges, listItemInfoByRangeKey);
  const nestedSelectedStarts = collectNestedSelectedListItemStarts(selectedInfoByFrom);
  const moveNodeCache = new Map<number, ProseNode>();

  for (const range of selectedRanges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (info) {
      if (nestedSelectedStarts.has(range.from)) {
        continue;
      }

      const moveItemNode = buildSelectedListItemNode(info, selectedInfoByFrom, moveNodeCache);
      if (insertInsideList) {
        content = appendListBuffer(content, wrappedListBuffer);
        wrappedListBuffer = null;
        content = content.append(Fragment.from(moveItemNode));
        continue;
      }

      if (
        wrappedListBuffer
        && wrappedListBuffer.type === info.parentType
        && areNodeAttrsEqual(wrappedListBuffer.attrs, info.parentAttrs)
      ) {
        wrappedListBuffer.items.push(moveItemNode);
      } else {
        content = appendListBuffer(content, wrappedListBuffer);
        wrappedListBuffer = {
          type: info.parentType,
          attrs: info.parentAttrs,
          items: [moveItemNode],
        };
      }
      continue;
    }

    content = appendListBuffer(content, wrappedListBuffer);
    wrappedListBuffer = null;
    content = content.append(view.state.doc.slice(range.from, range.to).content);
  }

  return appendListBuffer(content, wrappedListBuffer);
}

export function prepareBlockMove(
  view: EditorView,
  moveContext: BlockMoveContext,
): PreparedBlockMove | null {
  const { state } = view;
  const { selectedRanges, listItemInfoByRangeKey, deleteRanges } = moveContext;

  let tr = state.tr;
  for (let i = deleteRanges.length - 1; i >= 0; i -= 1) {
    const range = deleteRanges[i];
    tr = tr.delete(range.from, range.to);
  }

  let safeTargetPos = Math.max(0, Math.min(moveContext.targetPos, tr.doc.content.size));

  const sourceResidualInsertions = collectSourceResidualInsertions(selectedRanges, listItemInfoByRangeKey)
    .map((insertion) => ({
      pos: tr.mapping.map(insertion.from, -1),
      groups: insertion.groups,
    }))
    .sort((a, b) => a.pos - b.pos);

  let sourceInsertionOffset = 0;
  for (const insertion of sourceResidualInsertions) {
    const pos = Math.max(0, Math.min(insertion.pos + sourceInsertionOffset, tr.doc.content.size));
    const fragment = buildLiftedSourceFragment(insertion.groups, isInsertionInsideList(tr.doc, pos));
    if (fragment.size === 0) continue;

    const $pos = tr.doc.resolve(pos);
    const index = $pos.index();
    if (!$pos.parent.canReplace(index, index, fragment)) continue;

    tr = tr.insert(pos, fragment);
    sourceInsertionOffset += fragment.size;
    if (pos <= safeTargetPos) {
      safeTargetPos += fragment.size;
    }
  }

  safeTargetPos = Math.max(0, Math.min(safeTargetPos, tr.doc.content.size));
  if (hasMovedNonBlankContent(state.doc, selectedRanges)) {
    const cleaned = removeAdjacentBlankLinesForMoveTarget(tr, safeTargetPos);
    tr = cleaned.tr;
    safeTargetPos = cleaned.targetPos;
  }

  const insertInsideList = isInsertionInsideList(tr.doc, safeTargetPos);
  const $target = tr.doc.resolve(safeTargetPos);
  const targetIndex = $target.index();
  let movedContent = convertMovedFrontmatterToPlainText(
    view,
    buildMovedContent(view, selectedRanges, listItemInfoByRangeKey, insertInsideList),
    safeTargetPos,
  );
  if (movedContent.size === 0) return null;

  if (!$target.parent.canReplace(targetIndex, targetIndex, movedContent)) {
    const fallbackContent = convertMovedFrontmatterToPlainText(
      view,
      buildMovedContent(view, selectedRanges, listItemInfoByRangeKey, !insertInsideList),
      safeTargetPos,
    );
    if (fallbackContent.size === 0) return null;
    if (!$target.parent.canReplace(targetIndex, targetIndex, fallbackContent)) return null;
    movedContent = fallbackContent;
  }

  return {
    tr,
    targetPos: safeTargetPos,
    movedContent,
  };
}
