import { $node, $nodeAttr } from '@milkdown/kit/utils';
import { type DOMOutputSpec, type Node } from '@milkdown/kit/prose/model';
import type { CodeBlockAttrs } from './types';
import {
  normalizeCodeBlockLanguage,
  parseCodeLanguageFromClassName,
} from './codeBlockLanguage';
import { createCodeBlockAttrs, getDefaultCodeBlockLineNumbers } from './codeBlockSettings';

export function parseCodeBlockElementAttrs(dom: HTMLElement): CodeBlockAttrs {
  const code = dom.querySelector('code');
  const classLanguage = parseCodeLanguageFromClassName(code?.className ?? '');
  const datasetLanguage = dom.dataset.language || null;
  const lineNumbers = dom.dataset.lineNumbers;

  return createCodeBlockAttrs({
    language: normalizeCodeBlockLanguage(datasetLanguage || classLanguage),
    lineNumbers: lineNumbers == null ? getDefaultCodeBlockLineNumbers() : lineNumbers !== 'false',
    wrap: dom.dataset.wrap === 'true',
    collapsed: dom.dataset.collapsed === 'true',
  });
}

export function serializeCodeBlockNode(node: Node): DOMOutputSpec {
  const attrs = node.attrs as CodeBlockAttrs;

  return [
    'pre',
    {
      'data-language': attrs.language || '',
      'data-line-numbers': String(attrs.lineNumbers),
      'data-wrap': String(attrs.wrap),
      'data-collapsed': String(attrs.collapsed),
      class: 'code-block-wrapper',
    },
    ['code', { class: attrs.language ? `language-${attrs.language}` : '' }, 0],
  ];
}

export const codeBlockIdAttr = $nodeAttr('code_block', () => ({
  language: {
    default: null as string | null,
    get: (dom: HTMLElement) => normalizeCodeBlockLanguage(dom.dataset.language) ?? null,
    set: (value: string | null) => (value ? { 'data-language': value } : {}),
  },
  lineNumbers: {
    default: true,
    get: (dom: HTMLElement) =>
      dom.dataset.lineNumbers == null ? getDefaultCodeBlockLineNumbers() : dom.dataset.lineNumbers !== 'false',
    set: (value: boolean) => ({ 'data-line-numbers': String(value) }),
  },
  wrap: {
    default: false,
    get: (dom: HTMLElement) => dom.dataset.wrap === 'true',
    set: (value: boolean) => ({ 'data-wrap': String(value) }),
  },
  collapsed: {
    default: false,
    get: (dom: HTMLElement) => dom.dataset.collapsed === 'true',
    set: (value: boolean) => ({ 'data-collapsed': String(value) }),
  },
}));

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
    collapsed: { default: false },
  },
  parseDOM: [
    {
      tag: 'pre',
      preserveWhitespace: 'full' as const,
      getAttrs: (dom) => parseCodeBlockElementAttrs(dom as HTMLElement),
    },
  ],
  toDOM: serializeCodeBlockNode,
  parseMarkdown: {
    match: ({ type }) => type === 'code',
    runner: (state, node, type) => {
      const language = normalizeCodeBlockLanguage(node.lang as string | null);
      const value = (node.value as string) || '';

      state.openNode(type, createCodeBlockAttrs({ language }));
      if (value) {
        state.addText(value);
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'code_block',
    runner: (state, node) => {
      state.addNode('code', undefined, node.textContent, {
        lang: node.attrs.language || undefined,
      });
    },
  },
}));
