import { Selection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Serializer } from '@milkdown/kit/transformer';
import { serializeSliceToText } from '../clipboard/serializer';
import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
} from '../clipboard/markdownSerializationUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';

interface SerializeSelectedBlocksOptions {
  markdownSerializer?: Serializer | null;
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

function tryExecCommandCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }

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
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function writeTextToClipboard(text: string): Promise<void> {
  if (tryExecCommandCopy(text)) {
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
    }
  }

  tryExecCommandCopy(text);
}

export function deleteSelectedBlocks(
  view: EditorView,
  blocks: readonly BlockRange[],
  applyClearSelectionMeta: (tr: Transaction) => Transaction,
): boolean {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return false;

  const deleteRanges = buildDeleteRangesForBlockSelection(view.state, normalized);
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
