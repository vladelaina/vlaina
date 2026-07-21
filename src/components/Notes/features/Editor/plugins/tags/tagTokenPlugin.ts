import { Plugin, PluginKey, TextSelection } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import {
  getTransactionChangedRanges,
  transactionInsertedTextMatches,
  transactionTouchesDecorations,
  type DecorationSetLike,
} from '../shared/transactionStepText';
import {
  collectTagTokenDecorationsInRange,
  createTagTokenDecorations,
  MAX_TAG_TOKEN_CHARS,
  MAX_TAG_TOKEN_DECORATIONS,
  MAX_TAG_TOKEN_DOC_SCAN_NODES
} from './tagTokenDecorations';
export {
  collectTagTokenDecorationsInRange,
  createTagTokenDecorations,
  MAX_TAG_TOKEN_DECORATIONS,
  MAX_TAG_TOKEN_DOC_SCAN_NODES,
  TAG_TOKEN_HAS_NEXT_CLASS
} from './tagTokenDecorations';

export const tagTokenPluginKey = new PluginKey<DecorationSet>('editorTagToken');

export const MAX_TAG_TOKEN_UPDATE_RANGE_SCAN_NODES = MAX_TAG_TOKEN_DOC_SCAN_NODES;
export const MAX_TAG_TOKEN_EDGE_RECTS = 1024;
export const MAX_TAG_TOKEN_CHANGED_CONTEXT_CHARS = MAX_TAG_TOKEN_CHARS + 8;
const TAG_TOKEN_TRIGGER_TEXT_PATTERN = /#/u;

type TagTokenUpdateRange = {
  from: number;
  to: number;
};

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

function addTextblockRangeAt(doc: any, pos: number, ranges: TagTokenUpdateRange[]): void {
  if (typeof doc.resolve !== 'function') return;
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  const safePos = Math.max(0, Math.min(pos, docSize));

  try {
    const $pos = doc.resolve(safePos);
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth);
      if (!node?.isTextblock) continue;
      ranges.push({
        from: $pos.start(depth),
        to: $pos.end(depth),
      });
      return;
    }
  } catch {
  }
}

function mergeTagTokenUpdateRanges(ranges: TagTokenUpdateRange[]): TagTokenUpdateRange[] {
  if (ranges.length <= 1) return ranges;

  const sorted = [...ranges]
    .filter((range) => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: TagTokenUpdateRange[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || range.from > previous.to + 1) {
      merged.push({ ...range });
      continue;
    }
    previous.to = Math.max(previous.to, range.to);
  }

  return merged;
}

export function collectTagTokenUpdateRanges(
  doc: any,
  tr: unknown,
  maxScanNodes = MAX_TAG_TOKEN_UPDATE_RANGE_SCAN_NODES,
): TagTokenUpdateRange[] {
  const ranges: TagTokenUpdateRange[] = [];
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  let scannedNodes = 0;

  for (const range of getTransactionChangedRanges(tr)) {
    const from = Math.max(0, Math.min(range.newFrom, range.newTo, docSize));
    const to = Math.max(from, Math.min(Math.max(range.newFrom, range.newTo), docSize));

    addTextblockRangeAt(doc, from, ranges);
    addTextblockRangeAt(doc, to, ranges);

    if (to > from && typeof doc.nodesBetween === 'function') {
      let exhausted = false;
      doc.nodesBetween(from, to, (node: any, pos: number) => {
        scannedNodes += 1;
        if (scannedNodes > maxScanNodes) {
          exhausted = true;
          return false;
        }
        if (!node.isTextblock || typeof node.nodeSize !== 'number') return true;
        ranges.push({
          from: pos + 1,
          to: Math.max(pos + 1, pos + node.nodeSize - 1),
        });
        return true;
      });
      if (exhausted) {
        return [{ from: 0, to: docSize }];
      }
    }
  }

  return mergeTagTokenUpdateRanges(ranges);
}

export function updateTagTokenDecorationsForTransaction(
  previous: DecorationSet,
  tr: unknown,
  doc: any,
): DecorationSet {
  const mapped = previous.map((tr as { mapping: any }).mapping, doc);
  const ranges = collectTagTokenUpdateRanges(doc, tr);
  if (ranges.length === 0) {
    return mapped;
  }

  const decorationsToRemove: Decoration[] = [];
  for (const range of ranges) {
    decorationsToRemove.push(...mapped.find(range.from, range.to) as Decoration[]);
  }

  let next = decorationsToRemove.length > 0
    ? mapped.remove(decorationsToRemove)
    : mapped;
  let remainingBudget = MAX_TAG_TOKEN_DECORATIONS - next.find().length;
  if (remainingBudget <= 0) {
    return next;
  }

  for (const range of ranges) {
    if (remainingBudget <= 0) break;
    const decorations = collectTagTokenDecorationsInRange(doc, range.from, range.to, remainingBudget);
    if (decorations.length === 0) continue;
    next = next.add(doc, decorations);
    remainingBudget -= decorations.length;
  }

  return next;
}

function transactionChangedContextMayContainTagTrigger(doc: any, tr: unknown): boolean {
  if (typeof doc.textBetween !== 'function') return false;

  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  for (const range of getTransactionChangedRanges(tr)) {
    for (const pos of [range.newFrom, range.newTo]) {
      const safePos = Math.max(0, Math.min(pos, docSize));
      const from = Math.max(0, safePos - MAX_TAG_TOKEN_CHANGED_CONTEXT_CHARS);
      const to = Math.min(docSize, safePos + MAX_TAG_TOKEN_CHANGED_CONTEXT_CHARS);
      if (from >= to) continue;
      TAG_TOKEN_TRIGGER_TEXT_PATTERN.lastIndex = 0;
      if (TAG_TOKEN_TRIGGER_TEXT_PATTERN.test(doc.textBetween(from, to, '\n', '\ufffc'))) {
        return true;
      }
    }
  }

  return false;
}

export function transactionMayAffectTagTokenDecorations(
  previous: DecorationSetLike,
  tr: unknown,
  doc: any,
): boolean {
  return transactionInsertedTextMatches(tr, TAG_TOKEN_TRIGGER_TEXT_PATTERN)
    || transactionTouchesDecorations(previous, tr)
    || transactionChangedContextMayContainTagTrigger(doc, tr);
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
      return updateTagTokenDecorationsForTransaction(previous, tr, tr.doc);
    },
  },
  props: {
    decorations(state) {
      return tagTokenPluginKey.getState(state) ?? DecorationSet.empty;
    },
    handleDOMEvents: {
      click(view, event) {
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
          if (!view.state.doc.resolve(pos).parent.inlineContent) return false;
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
