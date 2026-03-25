import { $node } from '@milkdown/kit/utils';
import { type DOMOutputSpec, type Node } from '@milkdown/kit/prose/model';
import {
  getFrontmatterFenceLanguage,
  isFrontmatterFenceLanguage,
} from './frontmatterMarkdown';

export function serializeFrontmatterNode(_node: Node): DOMOutputSpec {
  return [
    'div',
    {
      'data-type': 'frontmatter',
      class: 'frontmatter-block-container',
    },
    0,
  ];
}

export const frontmatterSchema = $node('frontmatter', () => ({
  content: 'text*',
  group: 'block',
  code: true,
  defining: true,
  isolating: true,
  marks: '',
  parseDOM: [
    {
      tag: 'div[data-type="frontmatter"]',
      preserveWhitespace: 'full' as const,
    },
  ],
  toDOM: serializeFrontmatterNode,
  parseMarkdown: {
    match: (node) => node.type === 'code' && isFrontmatterFenceLanguage(node.lang),
    runner: (state, node, type) => {
      state.openNode(type);
      if (node.value) {
        state.addText(node.value as string);
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'frontmatter',
    runner: (state, node) => {
      state.addNode('code', undefined, node.textContent, {
        lang: getFrontmatterFenceLanguage(),
      });
    },
  },
}));
