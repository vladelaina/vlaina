// Callout plugin for highlighted note blocks
import { $node, $nodeAttr } from '@milkdown/kit/utils';
import type { CalloutBlockAttrs, IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';
import {
  getTextAlignmentComment,
  isTextAlignment,
} from '../floating-toolbar/blockAlignmentMarkdown';

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
      const children = (
        node.children as Array<{ type: string; children?: Array<{ type: string; value?: string }> }> | undefined
      ) ?? [];
      const nextChildren = [...children];
      const firstPara = nextChildren[0];
      const firstText = firstPara?.children?.[0];
      const text = firstText?.value || '';
      const emojiMatch = text.match(/^([\p{Emoji}]+)\s*/u);
      const emoji = emojiMatch?.[1] || '💡';

      if (firstPara?.type === 'paragraph' && firstPara.children?.length && firstText?.type === 'text') {
        const remainingText = text.replace(/^[\p{Emoji}]+\s*/u, '');
        const updatedChildren = [...firstPara.children];
        if (remainingText) {
          updatedChildren[0] = { ...firstText, value: remainingText };
          nextChildren[0] = { ...firstPara, children: updatedChildren };
        } else {
          updatedChildren.shift();
          if (updatedChildren.length > 0) {
            nextChildren[0] = { ...firstPara, children: updatedChildren };
          } else {
            nextChildren.shift();
          }
        }
      }

      state.openNode(type, {
        icon: { type: 'emoji', value: emoji },
        backgroundColor: 'yellow'
      });

      state.next(nextChildren as any);
      state.closeNode();
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'callout',
    runner: (state, node) => serializeCalloutToMarkdown(state, node)
  }
}));

// Combined callout plugin
export const calloutPlugin = [
  calloutIdAttr,
  calloutSchema
];

function getCalloutParagraphAlignmentComment(node: { attrs?: { align?: unknown } }): string | null {
  const align = node.attrs?.align;
  if (!isTextAlignment(align) || align === 'left') {
    return null;
  }

  return getTextAlignmentComment(align);
}

export function serializeCalloutToMarkdown(
  state: {
    openNode: (...args: any[]) => any;
    addNode: (...args: any[]) => any;
    next: (...args: any[]) => any;
    closeNode: (...args: any[]) => any;
  },
  node: {
    attrs: Record<string, unknown>;
    firstChild?: {
      type: { name: string };
      attrs?: Record<string, unknown>;
      content: unknown;
    } | null;
    childCount: number;
    child: (index: number) => unknown;
    content: unknown;
  }
): void {
  const icon = (node.attrs.icon as IconData | undefined) ?? DEFAULT_CALLOUT_ICON;
  const firstChild = node.firstChild;

  state.openNode('blockquote');

  if (firstChild?.type.name === 'paragraph') {
    const hasParagraphContent =
      typeof (firstChild.content as { size?: unknown } | null | undefined)?.size === 'number'
        ? ((firstChild.content as { size: number }).size > 0)
        : Boolean(firstChild.content);
    state.openNode('paragraph');
    state.addNode('text', undefined, hasParagraphContent ? `${icon.value} ` : `${icon.value}`);
    state.next(firstChild.content);
    state.closeNode();

    const alignmentComment = getCalloutParagraphAlignmentComment(firstChild);
    if (alignmentComment) {
      state.addNode('html', undefined, alignmentComment);
    }

    for (let index = 1; index < node.childCount; index += 1) {
      state.next(node.child(index));
    }
  } else {
    state.openNode('paragraph');
    state.addNode('text', undefined, `${icon.value}`);
    state.closeNode();
    state.next(node.content);
  }

  state.closeNode();
}
