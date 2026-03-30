import { Selection, type EditorState, type Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { Serializer } from '@milkdown/kit/transformer';
import { serializeSliceToText } from '../clipboard/serializer';
import {
  normalizeSerializedMarkdownBlock,
} from '../clipboard/markdownSerializationUtils';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { buildDeleteRangesForBlockSelection } from './listBlockUtils';
import { serializeLeadingFrontmatterMarkdown } from '../frontmatter/frontmatterMarkdown';

interface SerializeSelectedBlocksOptions {
  markdownSerializer?: Serializer | null;
}

const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+\.)\s+(?:\[(?: |x|X)\]\s+)?/;

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

function isListContainerName(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
}

function resolveListItemAtRange(
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

function serializeSingleTaskBlockWithoutMarker(
  state: EditorState,
  range: BlockRange,
): string | null {
  const listItem = resolveListItemAtRange(state, range);
  if (!listItem || listItem.type.name !== 'list_item' || listItem.attrs?.checked == null) {
    return null;
  }

  const firstChild = listItem.firstChild;
  if (!firstChild || firstChild.type.name !== 'paragraph' || listItem.childCount !== 1) {
    return null;
  }

  return normalizeSerializedMarkdownBlock(
    serializeSliceToText({
      content: {
        forEach(callback: (node: any) => void) {
          callback(firstChild);
        },
      },
    })
  );
}

function joinSerializedBlockRanges(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
  pieces: readonly string[],
): string {
  if (pieces.length === 0) return '';
  if (pieces.length === 1) return pieces[0] || '\n';

  let joined = pieces[0] ?? '';
  for (let index = 1; index < pieces.length; index += 1) {
    const previous = pieces[index - 1] ?? '';
    const next = pieces[index] ?? '';

    let separator = '\n\n';
    if (previous.length === 0 || next.length === 0) {
      separator = '\n';
    } else if (LIST_ITEM_MARKER_PATTERN.test(previous) && LIST_ITEM_MARKER_PATTERN.test(next)) {
      const previousTopLevel = resolveTopLevelBlockInfo(doc, ranges[index - 1].from);
      const nextTopLevel = resolveTopLevelBlockInfo(doc, ranges[index].from);
      const sameListContainer =
        previousTopLevel
        && nextTopLevel
        && isListContainerName(previousTopLevel.name)
        && isListContainerName(nextTopLevel.name)
        && previousTopLevel.from === nextTopLevel.from
        && previousTopLevel.to === nextTopLevel.to;
      separator = sameListContainer ? '\n' : '\n\n';
    }

    joined += separator + next;
  }

  return joined.length === 0 ? '\n' : joined;
}

export function serializeSelectedBlocksToText(
  state: EditorState,
  blocks: readonly BlockRange[],
  options: SerializeSelectedBlocksOptions = {},
): string {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return '';

  if (normalized.length === 1) {
    const singleTaskText = serializeSingleTaskBlockWithoutMarker(state, normalized[0]);
    if (singleTaskText !== null) {
      return serializeLeadingFrontmatterMarkdown(singleTaskText);
    }
  }

  const { markdownSerializer } = options;
  if (markdownSerializer) {
    try {
      const markdownPieces = normalized
        .map((block) => normalizeSerializedMarkdownBlock(markdownSerializer(state.doc.cut(block.from, block.to))));
      return serializeLeadingFrontmatterMarkdown(
        joinSerializedBlockRanges(state.doc, normalized, markdownPieces)
      );
    } catch {
    }
  }

  const pieces = normalized
    .map((block) => normalizeSerializedMarkdownBlock(serializeSliceToText(state.doc.slice(block.from, block.to))));

  return serializeLeadingFrontmatterMarkdown(
    joinSerializedBlockRanges(state.doc, normalized, pieces)
  );
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
