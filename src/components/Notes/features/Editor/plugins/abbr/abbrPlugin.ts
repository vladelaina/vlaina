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

export const abbrPluginKey = new PluginKey('abbr');

const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);
export const MAX_ABBR_TITLE_CHARS = 4096;
export const MAX_ABBR_DECORATIONS = 1000;
export const MAX_ABBR_DOC_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_ABBR_TEXT_SCAN_CHARS = 100_000;

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
  
  return DecorationSet.create(doc, decorations);
}

export const abbrDecorationPlugin = $prose(() => {
  return new Plugin({
    key: abbrPluginKey,
    state: {
      init(_, { doc }) {
        return createAbbrDecorations(doc);
      },
      apply(tr, old) {
        if (tr.docChanged) {
          return createAbbrDecorations(tr.doc);
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
