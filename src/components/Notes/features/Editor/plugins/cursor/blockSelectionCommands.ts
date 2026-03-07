import { Selection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Serializer } from '@milkdown/kit/transformer';
import { serializeSliceToText } from '../clipboard/serializer';
import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
} from '../clipboard/markdownSerializationUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

interface SerializeSelectedBlocksOptions {
  markdownSerializer?: Serializer | null;
}

const LIST_ITEM_NODE_NAME = 'list_item';

interface SelectedListItemInfo {
  range: BlockRange;
  parentFrom: number;
  parentTo: number;
  parentChildCount: number;
}

function getRangeKey(range: BlockRange): string {
  return `${range.from}:${range.to}`;
}

function isListContainerName(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
}

function getSelectedListItemInfo(state: EditorState, range: BlockRange): SelectedListItemInfo | null {
  const safeFrom = Math.max(0, Math.min(range.from, state.doc.content.size));
  const $from = state.doc.resolve(safeFrom);
  const nodeAfter = $from.nodeAfter;
  if (!nodeAfter) return null;
  if (nodeAfter.type.name !== LIST_ITEM_NODE_NAME) return null;
  if (nodeAfter.nodeSize !== range.to - range.from) return null;
  if (!isListContainerName($from.parent.type.name)) return null;
  if ($from.depth <= 0) return null;

  const parentFrom = $from.before($from.depth);
  const parentNode = $from.parent;
  return {
    range,
    parentFrom,
    parentTo: parentFrom + parentNode.nodeSize,
    parentChildCount: parentNode.childCount,
  };
}

function buildDeleteRanges(state: EditorState, ranges: readonly BlockRange[]): BlockRange[] {
  if (ranges.length === 0) return [];

  const listItemInfoByRangeKey = new Map<string, SelectedListItemInfo>();
  for (const range of ranges) {
    const info = getSelectedListItemInfo(state, range);
    if (!info) continue;
    listItemInfoByRangeKey.set(getRangeKey(range), info);
  }

  const selectedCountByParent = new Map<string, number>();
  const parentInfoByKey = new Map<string, SelectedListItemInfo>();
  for (const range of ranges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info) continue;
    const parentKey = `${info.parentFrom}:${info.parentTo}`;
    selectedCountByParent.set(parentKey, (selectedCountByParent.get(parentKey) ?? 0) + 1);
    parentInfoByKey.set(parentKey, info);
  }

  const fullySelectedParents = new Set<string>();
  for (const [parentKey, count] of selectedCountByParent) {
    const info = parentInfoByKey.get(parentKey);
    if (!info) continue;
    if (count === info.parentChildCount) {
      fullySelectedParents.add(parentKey);
    }
  }

  const deleteRanges: BlockRange[] = [];
  for (const range of ranges) {
    const info = listItemInfoByRangeKey.get(getRangeKey(range));
    if (!info) {
      deleteRanges.push(range);
      continue;
    }

    const parentKey = `${info.parentFrom}:${info.parentTo}`;
    if (fullySelectedParents.has(parentKey)) continue;
    deleteRanges.push(range);
  }

  for (const parentKey of fullySelectedParents) {
    const info = parentInfoByKey.get(parentKey);
    if (!info) continue;
    deleteRanges.push({
      from: info.parentFrom,
      to: info.parentTo,
    });
  }

  return normalizeBlockRanges(deleteRanges);
}

export function serializeSelectedBlocksToText(
  state: EditorState,
  blocks: readonly BlockRange[],
  options: SerializeSelectedBlocksOptions = {},
): string {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return '';

  const { markdownSerializer } = options;
  if (markdownSerializer) {
    try {
      const markdownPieces = normalized
        .map((block) => normalizeSerializedMarkdownBlock(markdownSerializer(state.doc.cut(block.from, block.to))));
      return joinSerializedBlocks(markdownPieces);
    } catch {
    }
  }

  const pieces = normalized
    .map((block) => normalizeSerializedMarkdownBlock(serializeSliceToText(state.doc.slice(block.from, block.to))));

  return joinSerializedBlocks(pieces);
}

export function setClipboardText(event: ClipboardEvent, text: string): void {
  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', text);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
  }
}

export async function writeTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
    }
  }

  if (typeof document === 'undefined') return;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

export function deleteSelectedBlocks(
  view: EditorView,
  blocks: readonly BlockRange[],
  applyClearSelectionMeta: (tr: Transaction) => Transaction,
): boolean {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return false;

  const deleteRanges = buildDeleteRanges(view.state, normalized);
  if (deleteRanges.length === 0) return false;

  const anchorHint = deleteRanges[0].from;
  let tr = view.state.tr;
  for (let i = deleteRanges.length - 1; i >= 0; i -= 1) {
    tr = tr.delete(deleteRanges[i].from, deleteRanges[i].to);
  }

  if (tr.doc.content.size === 0) {
    const paragraphType = tr.doc.type.schema.nodes.paragraph;
    if (paragraphType) {
      tr = tr.insert(0, paragraphType.create());
    }
  }

  const targetPos = Math.max(0, Math.min(anchorHint, tr.doc.content.size));
  tr = tr.setSelection(Selection.near(tr.doc.resolve(targetPos), -1));
  tr = applyClearSelectionMeta(tr);
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}
