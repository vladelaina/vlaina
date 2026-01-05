// Code plugin for syntax highlighting
import { $node, $nodeAttr } from '@milkdown/kit/utils';
import { normalizeLanguage } from '../../utils/shiki';
import type { CodeBlockAttrs } from './types';

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
  }
}));

// Code block schema
export const codeBlockSchema = $node('code_block', () => ({
  content: 'text*',
  group: 'block',
  code: true,
  defining: true,
  marks: '',
  attrs: {
    language: { default: null },
    lineNumbers: { default: true },
    wrap: { default: false }
  },
  parseDOM: [{
    tag: 'pre',
    preserveWhitespace: 'full' as const,
    getAttrs: (dom) => {
      const el = dom as HTMLElement;
      const code = el.querySelector('code');
      const className = code?.className || '';
      const langMatch = className.match(/language-(\w+)/);
      return {
        language: langMatch ? langMatch[1] : null,
        lineNumbers: el.dataset.lineNumbers !== 'false',
        wrap: el.dataset.wrap === 'true'
      };
    }
  }],
  toDOM: (node) => {
    const attrs = node.attrs as CodeBlockAttrs;
    return [
      'pre',
      {
        'data-language': attrs.language || '',
        'data-line-numbers': String(attrs.lineNumbers),
        'data-wrap': String(attrs.wrap),
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

// Combined code plugin (without custom view for now - using default rendering)
export const codePlugin = [
  codeBlockIdAttr,
  codeBlockSchema
];
