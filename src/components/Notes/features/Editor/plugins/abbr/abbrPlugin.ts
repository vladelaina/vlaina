import { $mark, $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import {
  appendBoundedAbbrDefinitions,
  createAbbrUsagePattern,
  extractAbbrDefinitionsFromText,
  type AbbrDefinition,
} from '@/components/common/markdown/abbrMarkdown';

export const abbrPluginKey = new PluginKey('abbr');

const SKIPPED_TEXT_PARENT_TYPES = new Set(['code_block', 'html_block']);
const SKIPPED_MARK_TYPES = new Set(['inlineCode', 'code']);

function shouldSkipTextNode(node: any, parent: any): boolean {
  if (parent && SKIPPED_TEXT_PARENT_TYPES.has(parent.type?.name)) {
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
      title: (dom as HTMLElement).getAttribute('title') ?? '',
    }),
  }],
  toDOM: (mark) => ['abbr', { title: mark.attrs.title, class: 'abbr' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'abbr',
    runner: (state, node, markType) => {
      const title = (node as { data?: { hProperties?: { title?: unknown } } }).data?.hProperties?.title;
      state.openMark(markType, { title: typeof title === 'string' ? title : '' });
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

function extractAbbrDefinitions(doc: any): AbbrDefinition[] {
  const definitions: AbbrDefinition[] = [];
  
  doc.descendants((node: any, _pos: number, parent: any) => {
    if (!node.isText || shouldSkipTextNode(node, parent)) {
      return;
    }

    const text = node.text || '';
    appendBoundedAbbrDefinitions(definitions, extractAbbrDefinitionsFromText(text));
  });
  
  return definitions;
}

function findAbbrUsages(doc: any, definitions: AbbrDefinition[]): { start: number; end: number; fullText: string }[] {
  const usages: { start: number; end: number; fullText: string }[] = [];
  
  if (definitions.length === 0) return usages;
  
  const abbrMap = new Map(definitions.map(d => [d.abbr, d.fullText]));
  const pattern = createAbbrUsagePattern(definitions);
  if (!pattern) return usages;
  
  doc.descendants((node: any, pos: number, parent: any) => {
    if (!node.isText || shouldSkipTextNode(node, parent)) {
      return;
    }

    const text = node.text || '';
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
      }
    }
  });
  
  return usages;
}

function createAbbrDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = [];
  const definitions = extractAbbrDefinitions(doc);
  const usages = findAbbrUsages(doc, definitions);
  
  for (const usage of usages) {
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
