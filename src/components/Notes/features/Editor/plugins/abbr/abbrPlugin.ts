import { $mark, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
  appendBoundedAbbrDefinitions,
  createAbbrUsagePattern,
  extractAbbrDefinitionsFromText,
  type AbbrDefinition,
} from '@/components/common/markdown/abbrMarkdown';
import {
  DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
  STOP_PROSE_SCAN,
  scanProseDescendants,
  type BoundedProseScanNode,
} from '../shared/boundedProseNodeScan';
import {
  getTransactionChangedRanges,
  transactionChangedParentTextMatches,
  transactionChangedPreviousParentTextMatches,
  transactionInsertedTextMatches,
  transactionTouchesDecorations,
  type DecorationSetLike,
} from '../shared/transactionStepText';

export const abbrPluginKey = new PluginKey('abbr');

const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);
export const MAX_ABBR_TITLE_CHARS = 4096;
export const MAX_ABBR_DECORATIONS = 1000;
export const MAX_ABBR_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_ABBR_TEXT_SCAN_CHARS = 100_000;
export const MAX_ABBR_CHANGED_CONTEXT_CHARS = 512;
const ABBR_DEFINITION_TRIGGER_PATTERN = /(?:^\*\[|[\n\r]\*\[)/u;
const abbrDefinitionsByDecorationSet = new WeakMap<object, AbbrDefinition[]>();

function rememberAbbrDefinitions(decorationSet: DecorationSet, definitions: AbbrDefinition[]): DecorationSet {
  abbrDefinitionsByDecorationSet.set(decorationSet, definitions);
  return decorationSet;
}

function mapAbbrDecorations(
  previous: DecorationSet,
  tr: { mapping: Parameters<DecorationSet['map']>[0] },
  doc: any,
): DecorationSet {
  const mapped = previous.map(tr.mapping, doc);
  return rememberAbbrDefinitions(mapped, abbrDefinitionsByDecorationSet.get(previous) ?? []);
}

export function normalizeAbbrTitle(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_ABBR_TITLE_CHARS) : '';
}

function shouldSkipTextNode(node: BoundedProseScanNode, parent: BoundedProseScanNode): boolean {
  const parentType = parent.type?.name;
  if (parentType && SKIPPED_TEXT_PARENT_TYPES.has(parentType)) {
    return true;
  }

  if (parent?.attrs?.vlainaEscapedBlockSyntax === 'abbrDefinition') {
    return true;
  }

  return node.marks?.some((mark: any) => SKIPPED_MARK_TYPES.has(mark.type?.name)) ?? false;
}

export const abbrMark = $mark('abbr', () => ({
  attrs: {
    title: { default: '' },
  },
  parseDOM: [{
    tag: 'abbr',
    getAttrs: (dom) => ({
      title: normalizeAbbrTitle((dom as HTMLElement).getAttribute('title')),
    }),
  }],
  toDOM: (mark) => ['abbr', { title: normalizeAbbrTitle(mark.attrs.title), class: 'abbr' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'abbr',
    runner: (state, node, markType) => {
      const title = (node as { data?: { hProperties?: { title?: unknown } } }).data?.hProperties?.title;
      state.openMark(markType, { title: normalizeAbbrTitle(title) });
      state.next((node as { children?: unknown }).children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'abbr',
    runner: (state, _mark, node) => {
      state.addNode('text', undefined, node.text || '');
      return true;
    },
  },
}));

export function extractAbbrDefinitions(
  doc: BoundedProseScanNode,
  maxNodes = MAX_ABBR_DOC_SCAN_NODES,
): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];

  scanProseDescendants(doc, (node, _pos, parent) => {
    if (!node.isText || shouldSkipTextNode(node, parent)) {
      return;
    }

    const text = node.text || '';
    if (text.length > MAX_ABBR_TEXT_SCAN_CHARS) {
      return;
    }
    appendBoundedAbbrDefinitions(definitions, extractAbbrDefinitionsFromText(text));
  }, maxNodes);

  return definitions;
}

export function findAbbrUsages(
  doc: BoundedProseScanNode,
  definitions: AbbrDefinition[],
  maxNodes = MAX_ABBR_DOC_SCAN_NODES,
): { start: number; end: number; fullText: string }[] {
  const usages: { start: number; end: number; fullText: string }[] = [];

  if (definitions.length === 0) return usages;

  const abbrMap = new Map(definitions.map(d => [d.abbr, d.fullText]));
  const pattern = createAbbrUsagePattern(definitions);
  if (!pattern) return usages;

  scanProseDescendants(doc, (node, pos, parent) => {
    if (usages.length >= MAX_ABBR_DECORATIONS) {
      return STOP_PROSE_SCAN;
    }

    if (!node.isText || shouldSkipTextNode(node, parent)) {
      return;
    }

    const text = node.text || '';
    if (text.length > MAX_ABBR_TEXT_SCAN_CHARS) {
      return;
    }
    if (extractAbbrDefinitionsFromText(text).length > 0) {
      return;
    }

    let match;

    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const abbr = match[1];
      const fullText = abbrMap.get(abbr);

      if (fullText) {
        usages.push({
          start: pos + match.index,
          end: pos + match.index + abbr.length,
          fullText
        });
        if (usages.length >= MAX_ABBR_DECORATIONS) {
          break;
        }
      }
    }

    return usages.length < MAX_ABBR_DECORATIONS ? undefined : STOP_PROSE_SCAN;
  }, maxNodes);

  return usages;
}

export function findAbbrUsagesInRange(
  doc: any,
  definitions: AbbrDefinition[],
  from: number,
  to: number,
): { start: number; end: number; fullText: string }[] {
  const usages: { start: number; end: number; fullText: string }[] = [];
  if (definitions.length === 0 || typeof doc.nodesBetween !== 'function') return usages;

  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;
  const start = Math.max(0, Math.min(from, docSize));
  const end = Math.max(start, Math.min(to, docSize));
  if (start >= end) return usages;

  const abbrMap = new Map(definitions.map(d => [d.abbr, d.fullText]));
  const pattern = createAbbrUsagePattern(definitions);
  if (!pattern) return usages;

  doc.nodesBetween(start, end, (node: BoundedProseScanNode, pos: number, parent: BoundedProseScanNode) => {
    if (usages.length >= MAX_ABBR_DECORATIONS) return false;
    if (!node.isText || shouldSkipTextNode(node, parent)) return true;

    const text = node.text || '';
    if (text.length > MAX_ABBR_TEXT_SCAN_CHARS) return true;
    if (extractAbbrDefinitionsFromText(text).length > 0) return true;

    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const abbr = match[1];
      const fullText = abbrMap.get(abbr);

      if (fullText) {
        usages.push({
          start: pos + match.index,
          end: pos + match.index + abbr.length,
          fullText
        });
        if (usages.length >= MAX_ABBR_DECORATIONS) break;
      }
    }

    return usages.length < MAX_ABBR_DECORATIONS;
  });

  return usages;
}

function createAbbrDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const definitions = extractAbbrDefinitions(doc);
  const usages = findAbbrUsages(doc, definitions);
  
  for (const usage of usages) {
    if (decorations.length >= MAX_ABBR_DECORATIONS) {
      break;
    }
    decorations.push(
      Decoration.inline(usage.start, usage.end, {
        nodeName: 'abbr',
        title: usage.fullText,
        class: 'abbr'
      })
    );
  }
  
  return rememberAbbrDefinitions(DecorationSet.create(doc, decorations), definitions);
}

export function transactionMayAffectAbbrDecorations(
  previous: DecorationSetLike,
  tr: unknown,
  oldDoc: any,
  newDoc: any,
): boolean {
  const definitions = abbrDefinitionsByDecorationSet.get(previous as object) ?? [];
  return transactionMayAffectAbbrDefinitions(tr, oldDoc, newDoc)
    || transactionMayAffectAbbrUsages(previous, tr, oldDoc, newDoc, definitions);
}

function transactionMayAffectAbbrDefinitions(
  tr: unknown,
  oldDoc: any,
  newDoc: any,
): boolean {
  return transactionInsertedTextMatches(tr, ABBR_DEFINITION_TRIGGER_PATTERN)
    || transactionChangedPreviousParentTextMatches(oldDoc, tr, ABBR_DEFINITION_TRIGGER_PATTERN)
    || transactionChangedParentTextMatches(newDoc, tr, ABBR_DEFINITION_TRIGGER_PATTERN);
}

function transactionChangedContextTextMatches(doc: any, tr: unknown, pattern: RegExp, side: 'old' | 'new'): boolean {
  if (typeof doc.resolve !== 'function' || typeof doc.textBetween !== 'function') return false;
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;

  for (const range of getTransactionChangedRanges(tr)) {
    const positions = side === 'old'
      ? [range.oldFrom, range.oldTo]
      : [range.newFrom, range.newTo];

    for (const pos of positions) {
      const safePos = Math.max(0, Math.min(pos, docSize));
      try {
        const $pos = doc.resolve(safePos);
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
          const node = $pos.node(depth);
          if (!node?.isTextblock) continue;
          const blockStart = $pos.start(depth);
          const blockEnd = $pos.end(depth);
          const from = Math.max(blockStart, safePos - MAX_ABBR_CHANGED_CONTEXT_CHARS);
          const to = Math.min(blockEnd, safePos + MAX_ABBR_CHANGED_CONTEXT_CHARS);
          if (from >= to) break;
          pattern.lastIndex = 0;
          if (pattern.test(doc.textBetween(from, to, '\n', '\ufffc'))) {
            return true;
          }
          break;
        }
      } catch {
      }
    }
  }

  return false;
}

function transactionMayAffectAbbrUsages(
  previous: DecorationSetLike,
  tr: unknown,
  oldDoc: any,
  newDoc: any,
  definitions: AbbrDefinition[],
): boolean {
  if (transactionTouchesDecorations(previous, tr)) {
    return true;
  }

  const usagePattern = createAbbrUsagePattern(definitions);
  if (!usagePattern) return false;

  return transactionChangedContextTextMatches(oldDoc, tr, usagePattern, 'old')
    || transactionChangedContextTextMatches(newDoc, tr, usagePattern, 'new');
}

type AbbrUpdateRange = {
  from: number;
  to: number;
};

function addTextblockRangeAt(doc: any, pos: number, ranges: AbbrUpdateRange[]): void {
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

function mergeAbbrUpdateRanges(ranges: AbbrUpdateRange[]): AbbrUpdateRange[] {
  if (ranges.length <= 1) return ranges;

  const sorted = [...ranges]
    .filter((range) => Number.isFinite(range.from) && Number.isFinite(range.to) && range.to > range.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: AbbrUpdateRange[] = [];

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

function collectAbbrUpdateRanges(doc: any, tr: unknown): AbbrUpdateRange[] {
  const ranges: AbbrUpdateRange[] = [];
  const docSize = typeof doc.content?.size === 'number' ? doc.content.size : 0;

  for (const range of getTransactionChangedRanges(tr)) {
    const from = Math.max(0, Math.min(range.newFrom, range.newTo, docSize));
    const to = Math.max(from, Math.min(Math.max(range.newFrom, range.newTo), docSize));

    addTextblockRangeAt(doc, from, ranges);
    addTextblockRangeAt(doc, to, ranges);

    if (to > from && typeof doc.nodesBetween === 'function') {
      doc.nodesBetween(from, to, (node: any, pos: number) => {
        if (!node.isTextblock || typeof node.nodeSize !== 'number') return true;
        ranges.push({
          from: pos + 1,
          to: Math.max(pos + 1, pos + node.nodeSize - 1),
        });
        return true;
      });
    }
  }

  return mergeAbbrUpdateRanges(ranges);
}

function createAbbrDecorationsFromUsages(usages: { start: number; end: number; fullText: string }[]): Decoration[] {
  const decorations: Decoration[] = [];
  for (const usage of usages) {
    if (decorations.length >= MAX_ABBR_DECORATIONS) break;
    decorations.push(
      Decoration.inline(usage.start, usage.end, {
        nodeName: 'abbr',
        title: usage.fullText,
        class: 'abbr'
      })
    );
  }
  return decorations;
}

function updateAbbrUsageDecorationsForTransaction(
  previous: DecorationSet,
  tr: { mapping: Parameters<DecorationSet['map']>[0] },
  doc: any,
  definitions: AbbrDefinition[],
): DecorationSet {
  const ranges = collectAbbrUpdateRanges(doc, tr);
  let next = previous.map(tr.mapping, doc);
  if (ranges.length === 0) {
    return rememberAbbrDefinitions(next, definitions);
  }

  const decorationsToRemove: Decoration[] = [];
  for (const range of ranges) {
    decorationsToRemove.push(...(next.find(range.from, range.to) as Decoration[]));
  }
  if (decorationsToRemove.length > 0) {
    next = next.remove(decorationsToRemove);
  }

  let remainingBudget = MAX_ABBR_DECORATIONS - next.find().length;
  for (const range of ranges) {
    if (remainingBudget <= 0) break;
    const usages = findAbbrUsagesInRange(doc, definitions, range.from, range.to);
    const decorations = createAbbrDecorationsFromUsages(usages).slice(0, remainingBudget);
    if (decorations.length === 0) continue;
    next = next.add(doc, decorations);
    remainingBudget -= decorations.length;
  }

  return rememberAbbrDefinitions(next, definitions);
}

export const abbrDecorationPlugin = $prose(() => {
  return new Plugin({
    key: abbrPluginKey,
    state: {
      init(_, { doc }) {
        return createAbbrDecorations(doc);
      },
      apply(tr, old, oldState, newState) {
        if (tr.docChanged) {
          if (transactionMayAffectAbbrDefinitions(tr, oldState.doc, newState.doc)) {
            return createAbbrDecorations(newState.doc);
          }

          const definitions = abbrDefinitionsByDecorationSet.get(old) ?? [];
          if (!transactionMayAffectAbbrUsages(old, tr, oldState.doc, newState.doc, definitions)) {
            return mapAbbrDecorations(old, tr, newState.doc);
          }

          return updateAbbrUsageDecorationsForTransaction(old, tr, newState.doc, definitions);
        }
        return old;
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
});

export const abbrPlugin = [
  abbrMark,
  abbrDecorationPlugin,
].flat();
