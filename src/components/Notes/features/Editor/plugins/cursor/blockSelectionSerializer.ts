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
import { normalizeBlockRanges, type BlockRange } from './blockSelectionUtils';
import { LIST_CONTAINER_NODE_NAMES } from '../shared/blockNodeTypes';

interface SerializeSelectedBlocksOptions {
  markdownSerializer?: Serializer | null;
}

const LIST_ITEM_MARKER_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+(?:\[(?: |x|X)\]\s+)?/;
const ORDERED_LIST_ITEM_MARKER_PATTERN = /^(\s*)(\d+)([.)])(\s+(?:\[(?: |x|X)\]\s+)?)/;
const FENCED_CODE_MARKER_PATTERN = /^([ \t]*)(`{3,}|~{3,})/;

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

function isListContainerName(name: string): boolean {
  return LIST_CONTAINER_NODE_NAMES.has(name);
}

function getOrderedListMarkerNumber(text: string): number | null {
  const match = ORDERED_LIST_ITEM_MARKER_PATTERN.exec(text);
  if (!match) return null;
  return Number(match[2]);
}

function renumberOrderedListMarker(text: string, number: number): string {
  return text.replace(
    ORDERED_LIST_ITEM_MARKER_PATTERN,
    (_match, indent: string, _oldNumber: string, delimiter: string, suffix: string) =>
      `${indent}${number}${delimiter}${suffix}`
  );
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
      const closing = FENCED_CODE_MARKER_PATTERN.exec(closingLine);
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
      return normalizeSelectedFencedCodeIndent(
        stripSingleListBlockMarker(
          normalizeSerializedMarkdownBlock(markdownSerializer(state.doc.cut(range.from, range.to)))
        )
      );
    } catch {
    }
  }

  return normalizeSelectedFencedCodeIndent(
    stripSingleListBlockMarker(
      normalizeSerializedMarkdownBlock(serializeSliceToText(state.doc.slice(range.from, range.to)))
    )
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
      if (sameListContainer && previousTopLevel.name === 'ordered_list') {
        const previousNumber = getOrderedListMarkerNumber(previous);
        if (previousNumber !== null) {
          joined += separator + renumberOrderedListMarker(next, previousNumber + 1);
          continue;
        }
      }
    }

    joined += separator + next;
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

export function serializeSelectedBlocksToText(
  state: EditorState,
  blocks: readonly BlockRange[],
  options: SerializeSelectedBlocksOptions = {},
): string {
  const normalized = normalizeBlockRanges(blocks);
  if (normalized.length === 0) return '';

  if (normalized.length === 1) {
    const singleListText = serializeSingleListBlockWithoutMarker(
      state,
      normalized[0],
      options.markdownSerializer,
    );
    if (singleListText !== null) {
      return serializeLeadingFrontmatterMarkdown(singleListText);
    }
  }

  const { markdownSerializer } = options;
  if (markdownSerializer) {
    try {
      const markdownPieces = normalized
        .map((block) => {
          const plainParagraphText = serializePlainParagraphBlock(state, block);
          if (plainParagraphText !== null) {
            return plainParagraphText;
          }

          return normalizeSelectedFencedCodeIndent(
            normalizeSerializedMarkdownBlock(markdownSerializer(state.doc.cut(block.from, block.to)))
          );
        });
      return serializeLeadingFrontmatterMarkdown(
        joinSerializedBlockRanges(state.doc, normalized, markdownPieces)
      );
    } catch {
    }
  }

  const pieces = normalized
    .map((block) => normalizeSelectedFencedCodeIndent(
      normalizeSerializedMarkdownBlock(serializeSliceToText(state.doc.slice(block.from, block.to)))
    ));

  return serializeLeadingFrontmatterMarkdown(
    joinSerializedBlockRanges(state.doc, normalized, pieces)
  );
}
