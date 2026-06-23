import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet, type Decoration as ProseDecoration } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { collectHtmlTagRanges } from '@/lib/markdown/markdownRanges';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
} from '../shared/boundedProseNodeScan';
import { getTransactionChangedRanges } from '../shared/transactionStepText';

export const htmlInlineSourceTextPluginKey = new PluginKey<DecorationSet>('htmlInlineSourceText');
export const MAX_HTML_INLINE_SOURCE_TEXT_DECORATIONS = 2000;
export const MAX_HTML_INLINE_SOURCE_TEXT_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_HTML_INLINE_SOURCE_TEXT_CHARS = 1024 * 1024;
export const MAX_HTML_INLINE_SOURCE_TEXT_CHANGED_CONTEXT_CHARS = 512;

const HTML_INLINE_SOURCE_TEXT_CLASS = 'md-html-inline md-html-source-text';
const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);

function textMayContainHtmlInlineSourceText(text: string): boolean {
  if (!text.includes('<')) return false;
  const scan = collectHtmlTagRanges(text, { start: 0, end: text.length }, 1);
  return scan.ranges.length > 0 || scan.protectedRanges.length > 0;
}

function transactionChangedContextMayContainHtmlInlineSourceText(doc: ProseNode, tr: unknown): boolean {
  if (typeof doc.textBetween !== 'function') return true;

  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  const ranges = getTransactionChangedRanges(tr);
  if (ranges.length === 0) return true;

  for (const range of ranges) {
    for (const pos of [range.newFrom, range.newTo]) {
      const safePos = Math.max(0, Math.min(pos, docSize));
      const from = Math.max(0, safePos - MAX_HTML_INLINE_SOURCE_TEXT_CHANGED_CONTEXT_CHARS);
      const to = Math.min(docSize, safePos + MAX_HTML_INLINE_SOURCE_TEXT_CHANGED_CONTEXT_CHARS);
      if (from >= to) continue;
      if (textMayContainHtmlInlineSourceText(doc.textBetween(from, to, '\n', '\ufffc'))) {
        return true;
      }
    }
  }

  return false;
}

function collectHtmlInlineSourceTextDecorationsFromTextNode(
  node: ProseNode,
  pos: number,
  parent: ProseNode | null,
  decorations: ProseDecoration[],
  maxDecorations: number,
) {
  if (decorations.length >= maxDecorations) return;
  if (parent?.type?.name && SKIPPED_TEXT_PARENT_TYPES.has(parent.type.name)) return;
  if (node.marks.some((mark) => SKIPPED_MARK_TYPES.has(mark.type.name))) return;

  const text = (node.text ?? '').slice(0, MAX_HTML_INLINE_SOURCE_TEXT_CHARS);
  if (!text.includes('<')) return;

  const scan = collectHtmlTagRanges(text, { start: 0, end: text.length }, maxDecorations - decorations.length);
  for (const range of [...scan.ranges, ...scan.protectedRanges]) {
    if (range.end <= range.start) continue;
    decorations.push(Decoration.inline(pos + range.start, pos + range.end, {
      class: HTML_INLINE_SOURCE_TEXT_CLASS,
    }));
    if (decorations.length >= maxDecorations) break;
  }
}

export function collectHtmlInlineSourceTextDecorations(
  doc: ProseNode,
  maxDecorations = MAX_HTML_INLINE_SOURCE_TEXT_DECORATIONS,
  maxScanNodes = MAX_HTML_INLINE_SOURCE_TEXT_SCAN_NODES,
): ProseDecoration[] {
  const decorations: ProseDecoration[] = [];

  scanProseDescendants(doc, (node, pos, parent) => {
    if (decorations.length >= maxDecorations) {
      return STOP_PROSE_SCAN;
    }

    const typedNode = node as ProseNode;
    if (typedNode.isText) {
      collectHtmlInlineSourceTextDecorationsFromTextNode(
        typedNode,
        pos,
        parent as ProseNode | null,
        decorations,
        maxDecorations,
      );
    }

    return decorations.length < maxDecorations ? undefined : STOP_PROSE_SCAN;
  }, maxScanNodes);

  return decorations;
}

function createHtmlInlineSourceTextDecorations(doc: ProseNode): DecorationSet {
  const decorations = collectHtmlInlineSourceTextDecorations(doc);
  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty;
}

export const htmlInlineSourceTextPlugin = $prose(() => new Plugin({
  key: htmlInlineSourceTextPluginKey,
  state: {
    init(_, { doc }) {
      return createHtmlInlineSourceTextDecorations(doc);
    },
    apply(tr, old) {
      if (!tr.docChanged) {
        return old;
      }
      if (
        old.find().length === 0
        && !transactionChangedContextMayContainHtmlInlineSourceText(tr.doc, tr)
      ) {
        return old.map(tr.mapping, tr.doc);
      }
      return createHtmlInlineSourceTextDecorations(tr.doc);
    },
  },
  props: {
    decorations(state) {
      return this.getState(state);
    },
  },
}));
