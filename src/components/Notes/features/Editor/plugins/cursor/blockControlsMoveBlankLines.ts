import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import { pruneContainedBlockRanges, type BlockRange } from './blockSelectionUtils';

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const EDITABLE_MARKDOWN_BLANK_LINE_PLACEHOLDER = '\u200B';

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

export function expandMovedFrontmatterDeleteRanges(
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

export function hasMovedNonBlankContent(
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

export function expandMoveDeleteRangesWithAdjacentBlankLines(
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

export function removeAdjacentBlankLinesForMoveTarget(
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
