import { $node, $nodeAttr, $prose } from '@milkdown/kit/utils';
import type { Ctx } from '@milkdown/kit/ctx';
import { blockquoteSchema } from '@milkdown/kit/preset/commonmark';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { CalloutBlockAttrs, IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';
import { CalloutNodeView } from './CalloutNodeView';
import {
  decodeCalloutIconComment,
  encodeCalloutIconComment,
  getCalloutIconValue,
  iconDataFromValue,
} from './calloutIconUtils';
import {
  getTextAlignmentComment,
  isTextAlignment,
} from '../floating-toolbar/blockAlignmentMarkdown';
import { updateSchemaFactory } from '../../themeSchemaUtils';

type MdastChild = {
  type: string;
  value?: string;
  children?: Array<{ type: string; value?: string }>;
};

type MdastBlockquote = {
  type: string;
  children?: MdastChild[];
};

function getCalloutIconFromMarkdownBlockquote(node: MdastBlockquote): IconData | null {
  if (node.type !== 'blockquote') {
    return null;
  }

  const firstChild = node.children?.[0];
  const iconComment = firstChild?.type === 'html'
    ? decodeCalloutIconComment(firstChild.value || '')
    : null;
  if (iconComment) {
    return iconDataFromValue(iconComment);
  }

  if (!firstChild || firstChild.type !== 'paragraph') {
    return null;
  }

  const text = firstChild.children?.[0];
  if (!text || text.type !== 'text') {
    return null;
  }

  const markerIcon = decodeCalloutIconComment(text.value || '');
  if (markerIcon) {
    return iconDataFromValue(markerIcon);
  }

  const emojiMatch = (text.value || '').match(/^([\p{Emoji}]+)\s*/u);
  return emojiMatch ? iconDataFromValue(emojiMatch[1]) : null;
}

function isCalloutMarkdownBlockquote(node: MdastBlockquote): boolean {
  return getCalloutIconFromMarkdownBlockquote(node) !== null;
}

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

export const calloutSchema = $node('callout', () => ({
  content: 'block+',
  group: 'block',
  defining: true,
  isolating: true,
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
      } catch {}
      return {
        icon,
        backgroundColor: el.dataset.bg || 'yellow'
      };
    }
  }],
  toDOM: (node) => {
    const attrs = node.attrs as CalloutBlockAttrs;
    const iconValue = getCalloutIconValue(attrs.icon);
    return [
      'div',
      {
        'data-type': 'callout',
        'data-icon': JSON.stringify(attrs.icon),
        'data-bg': attrs.backgroundColor,
        class: `callout callout-${attrs.backgroundColor}`
      },
      ['div', { class: 'callout-icon', contenteditable: 'false' }, iconValue],
      ['div', { class: 'callout-content' }, 0]
    ];
  },
  parseMarkdown: {
    match: (node) => {
      return isCalloutMarkdownBlockquote(node as MdastBlockquote);
    },
    runner: (state, node, type) => {
      const children = (
        node.children as Array<{ type: string; children?: Array<{ type: string; value?: string }> }> | undefined
      ) ?? [];
      const nextChildren = [...children];
      const firstPara = nextChildren[0];
      const firstHtmlIcon =
        firstPara?.type === 'html'
          ? decodeCalloutIconComment((firstPara as { value?: string }).value || '')
          : null;
      const firstText = firstPara?.type === 'paragraph' ? firstPara.children?.[0] : null;
      const text = firstText?.value || '';
      const markerIcon = firstHtmlIcon ? null : decodeCalloutIconComment(text);
      const emojiMatch = firstHtmlIcon || markerIcon ? null : text.match(/^([\p{Emoji}]+)\s*/u);
      const icon = firstHtmlIcon || markerIcon
        ? iconDataFromValue(firstHtmlIcon || markerIcon)
        : iconDataFromValue(emojiMatch?.[1] || '💡');

      if (firstHtmlIcon) {
        nextChildren.shift();
      } else if (firstPara?.type === 'paragraph' && firstPara.children?.length && firstText?.type === 'text') {
        const remainingText = markerIcon
          ? text.replace(/^\s*\[!callout-icon:[^\]]+\]\s*/u, '')
          : text.replace(/^[\p{Emoji}]+\s*/u, '');
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

      if (nextChildren.length === 0) {
        nextChildren.push({ type: 'paragraph', children: [] });
      }

      state.openNode(type, {
        icon,
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

export const calloutBlockquoteSchemaOverride = (ctx: Ctx) => {
  updateSchemaFactory(ctx, blockquoteSchema.key, (prev: any) => ({
    ...prev,
    parseMarkdown: {
      ...prev.parseMarkdown,
      match: (node: MdastBlockquote) => {
        if (isCalloutMarkdownBlockquote(node)) {
          return false;
        }

        return prev.parseMarkdown?.match?.(node) ?? node.type === 'blockquote';
      },
    },
  }));
};

function findCalloutDepth(view: EditorView): number | null {
  const { $from } = view.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'callout') {
      return depth;
    }
  }

  return null;
}

function isEmptySingleParagraphCallout(view: EditorView, calloutDepth: number): boolean {
  const { $from } = view.state.selection;
  const calloutNode = $from.node(calloutDepth);
  return (
    calloutNode.childCount === 1 &&
    calloutNode.firstChild?.type === view.state.schema.nodes.paragraph &&
    calloutNode.firstChild.content.size === 0
  );
}

export function handleEmptyCalloutExit(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  const paragraphType = state.schema.nodes.paragraph;
  if (!selection.empty || !paragraphType) {
    return false;
  }

  const calloutDepth = findCalloutDepth(view);
  if (calloutDepth === null || !isEmptySingleParagraphCallout(view, calloutDepth)) {
    return false;
  }

  const calloutPos = selection.$from.before(calloutDepth);
  let tr = state.tr.replaceWith(calloutPos, calloutPos + selection.$from.node(calloutDepth).nodeSize, paragraphType.create());
  tr = tr.setSelection(TextSelection.create(tr.doc, calloutPos + 1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

export function handleCalloutModEnterExit(view: EditorView): boolean {
  const { state } = view;
  const { selection } = state;
  const paragraphType = state.schema.nodes.paragraph;
  if (!selection.empty || !paragraphType) {
    return false;
  }

  const calloutDepth = findCalloutDepth(view);
  if (calloutDepth === null) {
    return false;
  }

  const calloutPos = selection.$from.before(calloutDepth);
  const calloutNode = selection.$from.node(calloutDepth);
  const insertPos = calloutPos + calloutNode.nodeSize;
  let tr = state.tr.insert(insertPos, paragraphType.create());
  tr = tr.setSelection(TextSelection.create(tr.doc, insertPos + 1)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

export const calloutKeymapPlugin = $prose(() => {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && !event.isComposing) {
          if (!handleCalloutModEnterExit(view)) {
            return false;
          }

          event.preventDefault();
          return true;
        }

        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) {
          return false;
        }

        if (event.key !== 'Enter' && event.key !== 'Backspace' && event.key !== 'Delete') {
          return false;
        }

        if (!handleEmptyCalloutExit(view)) {
          return false;
        }

        event.preventDefault();
        return true;
      },
      nodeViews: {
        callout: (node, view, getPos) => new CalloutNodeView(node, view, getPos as () => number | undefined),
      },
    },
  });
});

export const calloutPlugin = [
  calloutBlockquoteSchemaOverride,
  calloutIdAttr,
  calloutSchema,
  calloutKeymapPlugin
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
  const iconValue = getCalloutIconValue(icon);
  const firstChild = node.firstChild;

  state.openNode('blockquote');

  if (firstChild?.type.name === 'paragraph') {
    const hasParagraphContent =
      typeof (firstChild.content as { size?: unknown } | null | undefined)?.size === 'number'
        ? ((firstChild.content as { size: number }).size > 0)
        : Boolean(firstChild.content);
    state.openNode('paragraph');
    if (icon.type === 'emoji') {
      state.addNode('text', undefined, hasParagraphContent ? `${iconValue} ` : `${iconValue}`);
    } else {
      state.addNode('text', undefined, hasParagraphContent ? `${encodeCalloutIconComment(iconValue)} ` : encodeCalloutIconComment(iconValue));
    }
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
    if (icon.type === 'emoji') {
      state.addNode('text', undefined, `${iconValue}`);
    } else {
      state.addNode('text', undefined, encodeCalloutIconComment(iconValue));
    }
    state.closeNode();
    state.next(node.content);
  }

  state.closeNode();
}
