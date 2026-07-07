import { consumeLeadingCalloutEmoji } from '@/components/common/markdown/calloutEmoji';
import type { IconData } from './types';
import {
  decodeCalloutIconComment,
  encodeCalloutIconComment,
  getCalloutIconValue,
  iconDataFromValue,
  normalizeCalloutIcon,
  removeLeadingCalloutIconTextMarker,
} from './calloutIconUtils';
import {
  getTextAlignmentComment,
  isTextAlignment,
} from '../floating-toolbar/blockAlignmentMarkdown';

export type MdastChild = {
  type: string;
  value?: string;
  children?: Array<{ type: string; value?: string }>;
};

export type MdastBlockquote = {
  type: string;
  data?: {
    hProperties?: {
      className?: unknown;
      dataType?: unknown;
    };
  };
  children?: MdastChild[];
};

function getMdastClasses(node: MdastBlockquote): string[] {
  const className = node.data?.hProperties?.className;
  return Array.isArray(className)
    ? className.filter((value): value is string => typeof value === 'string')
    : [];
}

function isExpandedCalloutContainer(node: MdastBlockquote): boolean {
  if (node.type !== 'container') {
    return false;
  }

  const hProperties = node.data?.hProperties;
  return hProperties?.dataType === 'callout' || getMdastClasses(node).includes('callout');
}

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

  const emoji = consumeLeadingCalloutEmoji(text.value || '');
  return emoji ? iconDataFromValue(emoji.icon) : null;
}

export function isCalloutMarkdownBlockquote(node: MdastBlockquote): boolean {
  return getCalloutIconFromMarkdownBlockquote(node) !== null || isExpandedCalloutContainer(node);
}

function getChildrenFromExpandedCalloutContainer(node: MdastBlockquote): {
  icon: IconData;
  children: MdastChild[];
} {
  const containerChildren = node.children ?? [];
  const iconContainer = containerChildren.find((child) => {
    const classes = getMdastClasses(child as MdastBlockquote);
    return classes.includes('callout-icon');
  });
  const contentContainer = containerChildren.find((child) => {
    const classes = getMdastClasses(child as MdastBlockquote);
    return classes.includes('callout-content');
  });
  const iconText = iconContainer?.children?.map((child) => child.value ?? '').join('').trim();
  return {
    icon: iconDataFromValue(iconText || '💡'),
    children: contentContainer?.children?.length ? contentContainer.children : [{ type: 'paragraph', children: [] }],
  };
}

export function runCalloutMarkdownParser(
  state: {
    openNode: (...args: any[]) => any;
    next: (...args: any[]) => any;
    closeNode: (...args: any[]) => any;
  },
  node: MdastBlockquote,
  type: unknown,
): void {
  if (isExpandedCalloutContainer(node)) {
    const expanded = getChildrenFromExpandedCalloutContainer(node);
    state.openNode(type, {
      icon: expanded.icon,
      backgroundColor: 'yellow',
    });
    state.next(expanded.children as any);
    state.closeNode();
    return;
  }

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
  const emoji = firstHtmlIcon || markerIcon ? null : consumeLeadingCalloutEmoji(text);
  const icon = firstHtmlIcon || markerIcon
    ? iconDataFromValue(firstHtmlIcon || markerIcon)
    : iconDataFromValue(emoji?.icon || '💡');

  if (firstHtmlIcon) {
    nextChildren.shift();
  } else if (firstPara?.type === 'paragraph' && firstPara.children?.length && firstText?.type === 'text') {
    const remainingText = markerIcon
      ? removeLeadingCalloutIconTextMarker(text) ?? text
      : (emoji?.rest ?? text);
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
  const icon = normalizeCalloutIcon(node.attrs.icon);
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
