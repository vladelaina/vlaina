// Callout plugin for highlighted note blocks
import { $node, $nodeAttr } from '@milkdown/kit/utils';
import type { CalloutBlockAttrs, IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';

// Callout block attributes
export const calloutIdAttr = $nodeAttr('callout', () => ({
  icon: {
    default: DEFAULT_CALLOUT_ICON,
    get: (dom: HTMLElement) => {
      try {
        return JSON.parse(dom.dataset.icon || '{}');
      } catch {
        return DEFAULT_CALLOUT_ICON;
      }
    },
    set: (value: IconData) => ({ 'data-icon': JSON.stringify(value) })
  },
  backgroundColor: {
    default: 'yellow',
    get: (dom: HTMLElement) => dom.dataset.bg || 'yellow',
    set: (value: string) => ({ 'data-bg': value })
  }
}));

// Callout block schema
export const calloutSchema = $node('callout', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  attrs: {
    icon: { default: DEFAULT_CALLOUT_ICON },
    backgroundColor: { default: 'yellow' }
  },
  parseDOM: [{
    tag: 'div[data-type="callout"]',
    getAttrs: (dom) => {
      const el = dom as HTMLElement;
      let icon: IconData = DEFAULT_CALLOUT_ICON;
      try {
        icon = JSON.parse(el.dataset.icon || '{}');
      } catch {
        // Use default
      }
      return {
        icon,
        backgroundColor: el.dataset.bg || 'yellow'
      };
    }
  }],
  toDOM: (node) => {
    const attrs = node.attrs as CalloutBlockAttrs;
    return [
      'div',
      {
        'data-type': 'callout',
        'data-icon': JSON.stringify(attrs.icon),
        'data-bg': attrs.backgroundColor,
        class: `callout callout-${attrs.backgroundColor}`
      },
      ['div', { class: 'callout-icon', contenteditable: 'false' }, attrs.icon.value],
      ['div', { class: 'callout-content' }, 0]
    ];
  },
  parseMarkdown: {
    match: (node) => {
      // Match blockquote that starts with an emoji
      if (node.type !== 'blockquote') return false;
      const children = node.children as Array<{ type: string; children?: Array<{ type: string; value?: string }> }> | undefined;
      const firstChild = children?.[0];
      if (!firstChild || firstChild.type !== 'paragraph') return false;
      const text = firstChild.children?.[0];
      if (!text || text.type !== 'text') return false;
      // Check if starts with emoji pattern
      const emojiRegex = /^[\p{Emoji}]/u;
      return emojiRegex.test(text.value || '');
    },
    runner: (state, node, type) => {
      // Extract icon from first text
      const children = node.children as Array<{ type: string; children?: Array<{ type: string; value?: string }> }> | undefined;
      const firstPara = children?.[0];
      const firstText = firstPara?.children?.[0];
      const text = firstText?.value || '';
      
      // Extract emoji
      const emojiMatch = text.match(/^([\p{Emoji}]+)\s*/u);
      const emoji = emojiMatch?.[1] || '💡';
      
      state.openNode(type, {
        icon: { type: 'emoji', value: emoji },
        backgroundColor: 'yellow'
      });
      
      // Process remaining content
      if (firstPara) {
        const remainingText = text.replace(/^[\p{Emoji}]+\s*/u, '');
        if (remainingText) {
          state.openNode(state.schema.nodes.paragraph);
          state.addText(remainingText);
          state.closeNode();
        }
      }
      
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'callout',
    runner: (state, node) => {
      const icon = (node.attrs as CalloutBlockAttrs).icon;
      
      state.openNode('blockquote');
      
      // Add icon to first paragraph
      let isFirst = true;
      node.forEach((child) => {
        if (isFirst && child.type.name === 'paragraph') {
          state.openNode('paragraph');
          state.addNode('text', undefined, `${icon.value} `);
          child.forEach((inline) => {
            state.next(inline);
          });
          state.closeNode();
          isFirst = false;
        } else {
          state.next(child);
        }
      });
      
      state.closeNode();
    }
  }
}));

// Combined callout plugin
export const calloutPlugin = [
  calloutIdAttr,
  calloutSchema
];