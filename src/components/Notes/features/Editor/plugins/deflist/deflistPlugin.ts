// Definition list plugin
// Supports: term\n: definition syntax

import { $node } from '@milkdown/kit/utils';

// Definition List container
export const definitionListSchema = $node('definition_list', () => ({
  content: '(definition_term definition_desc)+',
  group: 'block',
  defining: true,
  parseDOM: [{
    tag: 'dl'
  }],
  toDOM: () => ['dl', { class: 'definition-list' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'definitionList',
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'definition_list',
    runner: (state, node) => {
      // Output as plain text with term: definition format
      node.forEach((child) => {
        state.next(child);
      });
    }
  }
}));

// Definition Term (dt)
export const definitionTermSchema = $node('definition_term', () => ({
  content: 'inline*',
  group: 'block',
  defining: true,
  parseDOM: [{
    tag: 'dt'
  }],
  toDOM: () => ['dt', { class: 'definition-term' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'definitionTerm',
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'definition_term',
    runner: (state, node) => {
      state.openNode('paragraph');
      state.next(node.content);
      state.closeNode();
    }
  }
}));

// Definition Description (dd)
export const definitionDescSchema = $node('definition_desc', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  parseDOM: [{
    tag: 'dd'
  }],
  toDOM: () => ['dd', { class: 'definition-desc' }, 0],
  parseMarkdown: {
    match: (node) => node.type === 'definitionDescription',
    runner: (state, node, type) => {
      state.openNode(type);
      state.next(node.children);
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'definition_desc',
    runner: (state, node) => {
      state.openNode('paragraph');
      state.addNode('text', undefined, ': ');
      state.next(node.content);
      state.closeNode();
    }
  }
}));

// Combined definition list plugin
export const deflistPlugin = [
  definitionListSchema,
  definitionTermSchema,
  definitionDescSchema
];
