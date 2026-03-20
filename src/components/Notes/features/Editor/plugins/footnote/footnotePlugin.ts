import { $node, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import type { FootnoteDefAttrs, FootnoteRefAttrs } from './types';

export const footnoteRefSchema = $node('footnote_ref', () => ({
  group: 'inline',
  inline: true,
  atom: true,
  attrs: {
    id: { default: '' }
  },
  parseDOM: [{
    tag: 'sup.footnote-ref',
    getAttrs: (dom) => ({
      id: (dom as HTMLElement).dataset.id || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as FootnoteRefAttrs;
    return [
      'sup',
      {
        class: 'footnote-ref',
        'data-id': attrs.id,
        title: `Footnote ${attrs.id}`
      },
      ['a', { href: `#fn-${attrs.id}` }, `[${attrs.id}]`]
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === 'footnoteReference',
    runner: (state, node, type) => {
      const id = (node.identifier as string) || (node.label as string) || '';
      state.addNode(type, { id });
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'footnote_ref',
    runner: (state, node) => {
      state.addNode('text', undefined, `[^${node.attrs.id}]`);
    }
  }
}));

export const footnoteDefSchema = $node('footnote_def', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: {
    id: { default: '' }
  },
  parseDOM: [{
    tag: 'div.footnote-def',
    getAttrs: (dom) => ({
      id: (dom as HTMLElement).dataset.id || ''
    })
  }],
  toDOM: (node) => {
    const attrs = node.attrs as FootnoteDefAttrs;
    return [
      'div',
      {
        class: 'footnote-def',
        'data-id': attrs.id,
        id: `fn-${attrs.id}`
      },
      ['span', { class: 'footnote-def-label', contenteditable: 'false' }, `[${attrs.id}]:`],
      ['div', { class: 'footnote-def-content' }, 0]
    ];
  },
  parseMarkdown: {
    match: (node) => node.type === 'footnoteDefinition',
    runner: (state, node, type) => {
      const id = (node.identifier as string) || (node.label as string) || '';
      state.openNode(type, { id });
      state.next(node.children);
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'footnote_def',
    runner: (state, node) => serializeFootnoteDefinitionToMarkdown(state, node)
  }
}));

export const footnoteRefInputRule = $inputRule(() => {
  return new InputRule(
    /\[\^([^\]]+)\]$/,
    (state, match, start, end) => {
      const id = match[1];
      if (!id) return null;

      const $pos = state.doc.resolve(start);
      const lineStart = $pos.start();
      const textBefore = state.doc.textBetween(lineStart, start);

      if (textBefore.trim() === '') return null;

      const { tr, schema } = state;
      const nodeType = schema.nodes.footnote_ref;
      if (!nodeType) return null;

      return tr
        .delete(start, end)
        .replaceSelectionWith(nodeType.create({ id }));
    }
  );
});

export const footnotePlugin = [
  footnoteRefSchema,
  footnoteDefSchema,
  footnoteRefInputRule
];

export function serializeFootnoteDefinitionToMarkdown(
  state: {
    openNode: (...args: any[]) => any;
    next: (...args: any[]) => any;
    closeNode: (...args: any[]) => any;
  },
  node: {
    attrs: { id?: string };
    content: unknown;
  }
): void {
  state.openNode('footnoteDefinition', undefined, {
    label: node.attrs.id ?? '',
    identifier: node.attrs.id ?? '',
  });
  state.next(node.content);
  state.closeNode();
}
