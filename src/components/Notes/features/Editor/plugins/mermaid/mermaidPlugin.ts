import { $node, $prose } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import type { MermaidAttrs } from './types';
import { isMermaidFenceLanguage } from './mermaidLanguage';
import { mermaidEnterPlugin } from './mermaidEnterPlugin';
import { createMermaidElement } from './mermaidDom';
import { MermaidNodeView } from './MermaidNodeView';

export const mermaidSchema = $node('mermaid', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  marks: '',
  attrs: {
    code: { default: '' }
  },
  parseDOM: [{
    tag: 'div[data-type="mermaid"]',
    getAttrs: (dom) => ({
      code: (dom as HTMLElement).dataset.code || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as MermaidAttrs;
    return createMermaidElement(attrs.code);
  },
  parseMarkdown: {
    match: (node) => {
      return node.type === 'code' && isMermaidFenceLanguage(node.lang as string | null | undefined);
    },
    runner: (state, node, type) => {
      const code = (node.value as string) || '';
      state.addNode(type, { code });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'mermaid',
    runner: (state, node) => {
      state.addNode('code', undefined, node.attrs.code, {
        lang: 'mermaid'
      });
    }
  }
}));

export const mermaidNodeViewPlugin = $prose(() => {
  return new Plugin({
    props: {
      nodeViews: {
        mermaid: (node, view, getPos) =>
          new MermaidNodeView(node, view, getPos as () => number | undefined),
      },
    },
  });
});

export const mermaidPlugin = [
  mermaidSchema,
  mermaidNodeViewPlugin,
  mermaidEnterPlugin,
];
