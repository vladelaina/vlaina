import type { EditorState } from '@milkdown/kit/prose/state';
import { normalizeSerializedMarkdownBlock } from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeSliceToText } from '../clipboard/serializer';
import {
  isBackslashHardBreakSourceTextNode,
  isNonInlineHardBreakNode,
} from '../hard-break/backslashHardBreakNodes';
import type { BlockRange } from './blockSelectionUtils';

type ParagraphInlineRangeInfo = { paragraphFrom: number; paragraphTo: number };

function isHardBreakNodeName(name: string | undefined): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}

function resolveParagraphInlineRangeInfo(
  doc: EditorState['doc'],
  range: BlockRange,
): ParagraphInlineRangeInfo | null {
  if (typeof doc?.content?.size !== 'number' || typeof doc.resolve !== 'function') {
    return null;
  }

  const safeFrom = Math.max(0, Math.min(range.from, doc.content.size));
  const safeTo = Math.max(safeFrom, Math.min(range.to, doc.content.size));

  try {
    const $from = doc.resolve(safeFrom);
    for (let depth = $from.depth; depth >= 0; depth -= 1) {
      const node = $from.node(depth);
      if (node.type.name !== 'paragraph') continue;

      const paragraphFrom = depth === 0 ? 0 : $from.before(depth);
      const paragraphTo = paragraphFrom + node.nodeSize;
      const contentFrom = paragraphFrom + 1;
      const contentTo = paragraphTo - 1;
      if (safeFrom < contentFrom || safeTo > contentTo) return null;
      return { paragraphFrom, paragraphTo };
    }
  } catch {
  }

  return null;
}

function isIgnorableInlineRangeGap(
  doc: EditorState['doc'],
  from: number,
  to: number,
): boolean {
  if (from >= to) return true;

  let isIgnorable = true;
  try {
    doc.nodesBetween(from, to, (node, pos) => {
      if (!isIgnorable) return false;
      if (node.isText) {
        if (isBackslashHardBreakSourceTextNode(node)) {
          return true;
        }

        const textFrom = Math.max(from, pos);
        const textTo = Math.min(to, pos + node.nodeSize);
        const text = node.text?.slice(textFrom - pos, textTo - pos) ?? '';
        if (/\S/.test(text)) {
          isIgnorable = false;
          return false;
        }
        return true;
      }
      if (isHardBreakNodeName(node.type?.name)) {
        return true;
      }
      isIgnorable = false;
      return false;
    });
  } catch {
    return false;
  }

  return isIgnorable;
}

export function coalesceParagraphInlineRanges(
  doc: EditorState['doc'],
  ranges: readonly BlockRange[],
): BlockRange[] {
  const coalesced: BlockRange[] = [];

  for (const range of ranges) {
    const currentInfo = resolveParagraphInlineRangeInfo(doc, range);
    const previous = coalesced[coalesced.length - 1];
    const previousInfo = previous ? resolveParagraphInlineRangeInfo(doc, previous) : null;

    if (
      previous
      && currentInfo
      && previousInfo
      && previousInfo.paragraphFrom === currentInfo.paragraphFrom
      && previousInfo.paragraphTo === currentInfo.paragraphTo
      && previous.to <= range.from
      && isIgnorableInlineRangeGap(doc, previous.to, range.from)
    ) {
      previous.to = Math.max(previous.to, range.to);
      continue;
    }

    coalesced.push({ ...range });
  }

  return coalesced;
}

function endsAtBackslashHardBreakSourceBoundary(
  doc: EditorState['doc'],
  to: number,
): boolean {
  if (typeof doc?.content?.size !== 'number' || typeof doc.resolve !== 'function') {
    return false;
  }

  const safeTo = Math.max(0, Math.min(to, doc.content.size));
  try {
    const $to = doc.resolve(safeTo);
    return (
      isBackslashHardBreakSourceTextNode($to.nodeBefore)
      && isNonInlineHardBreakNode($to.nodeAfter)
    );
  } catch {
    return false;
  }
}

function normalizeParagraphInlineCopyText(
  doc: EditorState['doc'],
  block: BlockRange,
  text: string,
): string {
  const visibleText = endsAtBackslashHardBreakSourceBoundary(doc, block.to)
    ? text.replace(/\\$/, '')
    : text;
  return normalizeSerializedMarkdownBlock(visibleText);
}

export function serializeParagraphInlineRange(
  state: EditorState,
  block: BlockRange,
): string | null {
  if (!resolveParagraphInlineRangeInfo(state.doc, block)) return null;
  return normalizeParagraphInlineCopyText(
    state.doc,
    block,
    serializeSliceToText(state.doc.slice(block.from, block.to))
  );
}
