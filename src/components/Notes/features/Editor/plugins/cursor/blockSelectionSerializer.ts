import type { EditorState } from '@milkdown/kit/prose/state';
import type { Serializer } from '@milkdown/kit/transformer';
import { serializeSliceToText } from '../clipboard/serializer';
import { normalizeSerializedMarkdownBlock } from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeLeadingFrontmatterMarkdown } from '../frontmatter/frontmatterMarkdown';
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';

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
