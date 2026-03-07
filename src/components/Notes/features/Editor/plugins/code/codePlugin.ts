// Code plugin for syntax highlighting
import { $node, $nodeAttr, $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { Node, DOMOutputSpec } from '@milkdown/kit/prose/model';
import { EditorView } from '@milkdown/kit/prose/view';
import { normalizeLanguage } from '../../utils/shiki';
import type { CodeBlockAttrs } from './types';
import { CodeBlockNodeView } from './CodeBlockNodeView';
import { moveSelectionAfterNode } from './codeBlockSelectionUtils';

const CODE_LANGUAGE_CLASS_PATTERN = /language-([\w+-]+)/;

function parseCodeLanguageFromClassName(className: string): string | null {
  const match = CODE_LANGUAGE_CLASS_PATTERN.exec(className);
  return match ? match[1] : null;
}

// Code block attributes
export const codeBlockIdAttr = $nodeAttr('code_block', () => ({
  language: {
    default: null as string | null,
    get: (dom: HTMLElement) => dom.dataset.language || null,
    set: (value: string | null) => value ? { 'data-language': value } : {}
  },
  lineNumbers: {
    default: true,
    get: (dom: HTMLElement) => dom.dataset.lineNumbers !== 'false',
    set: (value: boolean) => ({ 'data-line-numbers': String(value) })
  },
  wrap: {
    default: false,
    get: (dom: HTMLElement) => dom.dataset.wrap === 'true',
    set: (value: boolean) => ({ 'data-wrap': String(value) })
  },
  collapsed: {
    default: false,
    get: (dom: HTMLElement) => dom.dataset.collapsed === 'true',
    set: (value: boolean) => ({ 'data-collapsed': String(value) })
  }
}));

// Code block schema
export const codeBlockSchema = $node('code_block', () => ({
  content: 'text*',
  group: 'block',
  code: true,
  defining: true,
  isolating: true,
  marks: '',
  attrs: {
    language: { default: null },
    lineNumbers: { default: true },
    wrap: { default: false },
    collapsed: { default: false }
  },
  parseDOM: [{
    tag: 'pre',
    preserveWhitespace: 'full' as const,
    getAttrs: (dom: any) => {
      const el = dom as HTMLElement;
      const code = el.querySelector('code');
      const className = code?.className || '';
      const language = parseCodeLanguageFromClassName(className);
      return {
        language,
        lineNumbers: el.dataset.lineNumbers !== 'false',
        wrap: el.dataset.wrap === 'true',
        collapsed: el.dataset.collapsed === 'true'
      };
    }
  }],
  toDOM: (node: Node): DOMOutputSpec => {
    const attrs = node.attrs as CodeBlockAttrs;
    return [
      'pre',
      {
        'data-language': attrs.language || '',
        'data-line-numbers': String(attrs.lineNumbers),
        'data-wrap': String(attrs.wrap),
        'data-collapsed': String(attrs.collapsed),
        class: 'code-block-wrapper'
      },
      ['code', { class: attrs.language ? `language-${attrs.language}` : '' }, 0]
    ];
  },
  parseMarkdown: {
    match: ({ type }) => type === 'code',
    runner: (state, node, type) => {
      const lang = node.lang as string | null;
      const value = node.value as string || '';
      state.openNode(type, { language: normalizeLanguage(lang) });
      if (value) {
        state.addText(value);
      }
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'code_block',
    runner: (state, node) => {
      state.addNode('code', undefined, node.textContent, {
        lang: node.attrs.language || undefined
      });
    }
  }
}));

// Plugin to attach the custom NodeView
export const codeBlockNodeViewPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        code_block: (node: Node, view: EditorView, getPos: () => number | undefined) => new CodeBlockNodeView(node, view, getPos)
      }
    }
  });
});

function findCodeBlockContext(state: EditorView['state']) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === 'code_block') {
      return {
        node,
        pos: $from.before(depth),
      };
    }
  }
  return null;
}

export const collapsedCodeBlockSelectionGuardPlugin = $prose(() => {
  return new Plugin({
    appendTransaction: (_transactions, _oldState, newState) => {
      const context = findCodeBlockContext(newState);
      if (!context) return null;
      if (!context.node.attrs.collapsed) return null;

      const { node, pos } = context;
      const tr = newState.tr;
      moveSelectionAfterNode(tr, pos, node.nodeSize);
      return tr.scrollIntoView();
    },
  });
});

// Combined code plugin
export const codePlugin = [
  codeBlockIdAttr,
  codeBlockSchema,
  codeBlockNodeViewPlugin,
  collapsedCodeBlockSelectionGuardPlugin,
];
