import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { isNoteTagToken } from '@/lib/notes/tags';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import {
  getTransactionChangedRanges,
  transactionInsertedTextMatches,
  transactionTouchesDecorations,
  type DecorationSetLike,
} from '../shared/transactionStepText';

export const tagTokenPluginKey = new PluginKey<DecorationSet>('editorTagToken');

const TAG_TOKEN_PATTERN = /(?<![\p{L}\p{N}_/-])#([\p{L}\p{N}_/-][\p{L}\p{N}_/-]*)/gu;
const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);
export const MAX_TAG_TOKEN_DECORATIONS = 1000;
export const MAX_TAG_TOKEN_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_TAG_TOKEN_INCREMENTAL_RESCAN_RANGES = 80;
export const MAX_TAG_TOKEN_INCREMENTAL_RESCAN_CHARS = 250_000;
const MAX_TAG_TOKEN_CHARS = 128;
const TAG_TOKEN_CHANGE_CONTEXT_CHARS = MAX_TAG_TOKEN_CHARS + 8;
export const MAX_TAG_TOKEN_EDGE_RECTS = 1024;
const TAG_TOKEN_TRIGGER_TEXT_PATTERN = /#/u;

export function resolveTagTokenEdgeOffset(
  token: HTMLElement,
  clientX: number,
  clientY: number,
): { textNode: Text; offset: number } | null {
  let textNode: Text | null = null;
  for (let index = 0; index < token.childNodes.length; index += 1) {
    const child = token.childNodes.item(index);
    if (child.nodeType === Node.TEXT_NODE && child.textContent) {
      textNode = child as Text;
      break;
    }
  }
  if (!textNode?.textContent) return null;

  const range = token.ownerDocument.createRange();
  range.selectNodeContents(textNode);
  const rects = range.getClientRects();
  if (rects.length > MAX_TAG_TOKEN_EDGE_RECTS) {
    range.detach();
    return null;
  }

  let lastRect: DOMRect | null = null;
  let matchedRect: DOMRect | null = null;
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects.item(index);
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    lastRect = rect;
    if (clientY >= rect.top - 4 && clientY <= rect.bottom + 4) {
      matchedRect = rect;
      break;
    }
  }
  range.detach();

  const rect = matchedRect ?? lastRect;
  if (!rect) return null;

  const edgeSlack = Math.max(3, Math.min(8, rect.width * 0.12));
  if (clientX >= rect.right - edgeSlack) {
    return { textNode, offset: textNode.textContent.length };
  }
  if (clientX <= rect.left + edgeSlack) {
    return { textNode, offset: 0 };
  }
  return null;
}

export function createTagTokenDecorations(doc: any): DecorationSet {
  return DecorationSet.create(doc, collectTagTokenDecorations(doc));
}

function pushTagTokenDecorationsForTextNode(
  decorations: Decoration[],
  node: any,
  pos: number,
  parent: any,
  maxDecorations: number,
): void {
  if (decorations.length >= maxDecorations) {
    return;
  }

  const parentType = parent.type?.name;
  if (parentType && SKIPPED_TEXT_PARENT_TYPES.has(parentType)) {
    return;
  }

  if (node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name))) {
    return;
  }

  const text = node.text ?? '';
  TAG_TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_TOKEN_PATTERN.exec(text)) !== null) {
    const tag = match[1]?.trim();
    if (!tag || tag.length > MAX_TAG_TOKEN_CHARS || !isNoteTagToken(tag)) {
      continue;
    }

    decorations.push(
      Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
        class: `editor-tag-token tag cm-hashtag cm-meta v-tag ${chatComposerPillSurfaceClass}`,
        'data-editor-tag-token': 'true',
      }, {
        inclusiveStart: false,
        inclusiveEnd: false,
      }),
    );
    if (decorations.length >= maxDecorations) {
      break;
    }
  }
}

export function collectTagTokenDecorations(doc: any): Decoration[] {
  const decorations: Decoration[] = [];

  scanProseDescendants(doc, (node, pos, parent) => {
    if (decorations.length >= MAX_TAG_TOKEN_DECORATIONS) {
      return STOP_PROSE_SCAN;
    }

    if (!node.isText) {
      return;
    }

    pushTagTokenDecorationsForTextNode(
      decorations,
      node,
      pos,
      parent,
      MAX_TAG_TOKEN_DECORATIONS
    );

    return decorations.length < MAX_TAG_TOKEN_DECORATIONS ? undefined : STOP_PROSE_SCAN;
  }, MAX_TAG_TOKEN_DOC_SCAN_NODES);

  return decorations;
}

function getDocContentSize(doc: any): number {
  const size = doc?.content?.size;
  return typeof size === 'number' && Number.isFinite(size) ? Math.max(0, size) : 0;
}

function clampDocPos(doc: any, pos: number): number {
  const size = getDocContentSize(doc);
  return Math.max(0, Math.min(size, Math.floor(Number.isFinite(pos) ? pos : 0)));
}

function addTagTokenRescanRange(
  ranges: Array<{ from: number; to: number }>,
  from: number,
  to: number,
): void {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.max(start, Math.max(from, to));
  if (end <= start) {
    return;
  }
  ranges.push({ from: start, to: end });
}

function addResolvedTextblockRange(
  doc: any,
  ranges: Array<{ from: number; to: number }>,
  pos: number,
): void {
  try {
    const $pos = doc.resolve(clampDocPos(doc, pos));
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (!node?.isTextblock) {
        continue;
      }
      addTagTokenRescanRange(ranges, $pos.start(depth), $pos.end(depth));
      return;
    }
  } catch {
  }
}

function addTextblockRangesBetween(
  doc: any,
  ranges: Array<{ from: number; to: number }>,
  from: number,
  to: number,
): void {
  if (typeof doc?.nodesBetween !== 'function') {
    addResolvedTextblockRange(doc, ranges, from);
    addResolvedTextblockRange(doc, ranges, to);
    return;
  }

  const start = clampDocPos(doc, from);
  const end = Math.max(start, clampDocPos(doc, to));
  addResolvedTextblockRange(doc, ranges, start);
  addResolvedTextblockRange(doc, ranges, end);
  if (end <= start) {
    return;
  }

  try {
    doc.nodesBetween(start, end, (node: any, pos: number) => {
      if (!node?.isTextblock) {
        return true;
      }
      const nodeStart = pos + 1;
      const nodeEnd = pos + Math.max(1, node.nodeSize ?? 1) - 1;
      addTagTokenRescanRange(ranges, nodeStart, nodeEnd);
      return false;
    });
  } catch {
  }
}

function mergeTagTokenRescanRanges(
  ranges: Array<{ from: number; to: number }>,
): Array<{ from: number; to: number }> {
  if (ranges.length <= 1) {
    return ranges;
  }

  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to);
  const merged: Array<{ from: number; to: number }> = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.from <= previous.to + 1) {
      previous.to = Math.max(previous.to, range.to);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function collectTagTokenRescanRanges(
  doc: any,
  tr: unknown,
): Array<{ from: number; to: number }> | null {
  const changedRanges = getTransactionChangedRanges(tr);
  if (changedRanges.length === 0) {
    return null;
  }

  const ranges: Array<{ from: number; to: number }> = [];
  for (const range of changedRanges) {
    addTextblockRangesBetween(doc, ranges, range.newFrom, range.newTo);
    if (ranges.length > MAX_TAG_TOKEN_INCREMENTAL_RESCAN_RANGES) {
      return null;
    }
  }

  const merged = mergeTagTokenRescanRanges(ranges);
  const totalChars = merged.reduce((sum, range) => sum + Math.max(0, range.to - range.from), 0);
  if (
    merged.length === 0 ||
    merged.length > MAX_TAG_TOKEN_INCREMENTAL_RESCAN_RANGES ||
    totalChars > MAX_TAG_TOKEN_INCREMENTAL_RESCAN_CHARS
  ) {
    return null;
  }
  return merged;
}

export function collectTagTokenDecorationsInRanges(
  doc: any,
  ranges: readonly { from: number; to: number }[],
  maxDecorations = MAX_TAG_TOKEN_DECORATIONS,
): Decoration[] {
  const decorations: Decoration[] = [];
  if (maxDecorations <= 0 || typeof doc?.nodesBetween !== 'function') {
    return decorations;
  }

  for (const range of ranges) {
    const from = clampDocPos(doc, range.from);
    const to = Math.max(from, clampDocPos(doc, range.to));
    if (to <= from) {
      continue;
    }

    doc.nodesBetween(from, to, (node: any, pos: number, parent: any) => {
      if (decorations.length >= maxDecorations) {
        return false;
      }
      if (node.isText) {
        pushTagTokenDecorationsForTextNode(
          decorations,
          node,
          pos,
          parent,
          maxDecorations
        );
      }
      return decorations.length < maxDecorations;
    });

    if (decorations.length >= maxDecorations) {
      break;
    }
  }

  return decorations;
}

function updateTagTokenDecorationsIncrementally(
  previous: DecorationSet,
  tr: unknown,
  doc: any,
): DecorationSet | null {
  const ranges = collectTagTokenRescanRanges(doc, tr);
  if (!ranges) {
    return null;
  }

  const mapped = previous.map((tr as { mapping: Parameters<DecorationSet['map']>[0] }).mapping, doc);
  const existingCount = mapped.find().length;
  const decorationsToRemove = ranges.flatMap((range) => mapped.find(range.from, range.to));
  const withoutChangedDecorations = decorationsToRemove.length > 0
    ? mapped.remove(decorationsToRemove)
    : mapped;
  const nextBudget = MAX_TAG_TOKEN_DECORATIONS - existingCount + decorationsToRemove.length;
  const nextDecorations = collectTagTokenDecorationsInRanges(doc, ranges, nextBudget);
  return nextDecorations.length > 0
    ? withoutChangedDecorations.add(doc, nextDecorations)
    : withoutChangedDecorations;
}

export function transactionMayAffectTagTokenDecorations(
  previous: DecorationSetLike,
  tr: unknown,
  doc: any,
): boolean {
  return transactionInsertedTextMatches(tr, TAG_TOKEN_TRIGGER_TEXT_PATTERN)
    || transactionTouchesDecorations(previous, tr)
    || transactionChangedNearbyTagTextMatches(doc, tr);
}

function transactionChangedNearbyTagTextMatches(doc: any, tr: unknown): boolean {
  const ranges = getTransactionChangedRanges(tr);
  for (const range of ranges) {
    for (const pos of [range.newFrom, range.newTo]) {
      try {
        const $pos = doc.resolve(clampDocPos(doc, pos));
        if (!$pos.parent?.isTextblock) {
          continue;
        }
        const from = Math.max(0, $pos.parentOffset - TAG_TOKEN_CHANGE_CONTEXT_CHARS);
        const to = Math.min(
          $pos.parent.content.size,
          $pos.parentOffset + TAG_TOKEN_CHANGE_CONTEXT_CHARS
        );
        TAG_TOKEN_TRIGGER_TEXT_PATTERN.lastIndex = 0;
        if (TAG_TOKEN_TRIGGER_TEXT_PATTERN.test($pos.parent.textBetween(from, to, '\n', '\ufffc'))) {
          return true;
        }
      } catch {
      }
    }
  }
  return false;
}

export const tagTokenPlugin = $prose(() => new Plugin({
  key: tagTokenPluginKey,
  state: {
    init: (_config, state) => createTagTokenDecorations(state.doc),
    apply: (tr, previous) => {
      if (!tr.docChanged) {
        return previous;
      }
      if (!transactionMayAffectTagTokenDecorations(previous, tr, tr.doc)) {
        return previous.map(tr.mapping, tr.doc);
      }
      return updateTagTokenDecorationsIncrementally(previous, tr, tr.doc)
        ?? createTagTokenDecorations(tr.doc);
    },
  },
  props: {
    decorations(state) {
      return tagTokenPluginKey.getState(state) ?? DecorationSet.empty;
    },
    handleDOMEvents: {
      mousedown(view, event) {
        if (!(event instanceof MouseEvent)) return false;
        if (event.button !== 0) return false;
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return false;
        const target = event.target instanceof Element ? event.target : event.target instanceof Node ? event.target.parentElement : null;
        const token = target?.closest('[data-editor-tag-token="true"]');
        if (!(token instanceof HTMLElement) || !view.dom.contains(token)) return false;

        const edge = resolveTagTokenEdgeOffset(token, event.clientX, event.clientY);
        if (!edge) return false;

        try {
          const pos = view.posAtDOM(edge.textNode, edge.offset);
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)).scrollIntoView());
          view.focus();
          event.preventDefault();
          return true;
        } catch {
          return false;
        }
      },
    },
  },
}));
