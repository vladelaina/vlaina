// Footnote plugin for GFM-style footnotes
// Supports: [^1] references and [^1]: definitions

import { $node, $inputRule } from '@milkdown/kit/utils';
import { InputRule } from '@milkdown/kit/prose/inputrules';
import type { FootnoteDefAttrs, FootnoteRefAttrs } from './types';

// ============================================
// Footnote Reference: [^1]
// ============================================

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
      // Output as [^id] text
      state.addNode('text', undefined, `[^${node.attrs.id}]`);
    }
  }
}));

// ============================================
// Footnote Definition: [^1]: content
// ============================================

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
    runner: (state, node) => {
      // Output as [^id]: followed by content
      state.addNode('paragraph');
      state.addNode('text', undefined, `[^${node.attrs.id}]: `);
      state.next(node.content);
    }
  }
}));

// Input rule for footnote reference: [^id]
export const footnoteRefInputRule = $inputRule(() => {
  return new InputRule(
    /\[\^([^\]]+)\]$/,
    (state, match, start, end) => {
      const id = match[1];
      if (!id) return null;
      
      // Check if this is at the start of a line (definition) or inline (reference)
      const $pos = state.doc.resolve(start);
      const lineStart = $pos.start();
      const textBefore = state.doc.textBetween(lineStart, start);
      
      // If at line start, don't convert - let it be a definition
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

// Combined footnote plugin
export const footnotePlugin = [
  footnoteRefSchema,
  footnoteDefSchema,
  footnoteRefInputRule
];