import {
  createBgColorMdastNode,
  createTextColorMdastNode,
  createUnderlineMdastNode,
  containsRawHtmlTag,
} from './colorMarkdown';
import { MAX_INLINE_HTML_CONTAINER_CHILDREN } from './remarkHtmlConstants';
import type { MdastNode } from './remarkNotesTypes';

const INLINE_HTML_CLOSE_TAG_PATTERN = /^<\/([A-Za-z][A-Za-z0-9-]*)>$/i;

export const INLINE_HTML_CONTAINER_SEARCH_EXCEEDED = -2;

export function createInlineElementNode(type: string, children: MdastNode[]): MdastNode {
  if (type === 'highlight') {
    return {
      type,
      children,
      data: { hName: 'mark', hProperties: { className: ['highlight'] } },
    };
  }

  if (type === 'superscript') {
    return {
      type,
      children,
      data: { hName: 'sup', hProperties: { className: ['superscript'] } },
    };
  }

  if (type === 'subscript') {
    return {
      type,
      children,
      data: { hName: 'sub', hProperties: { className: ['subscript'] } },
    };
  }

  if (type === 'underline') {
    return createUnderlineMdastNode(children) as MdastNode;
  }

  return { type, children };
}

export function createColorInlineElementNode(
  tagName: 'mark' | 'span' | 'u',
  style: string | null,
  children: MdastNode[],
  extractCssColorDeclaration: (style: string, property: 'background-color' | 'color') => string | null
): MdastNode | null {
  if (tagName === 'span' && style) {
    const color = extractCssColorDeclaration(style, 'color');
    return color ? createTextColorMdastNode(color, children) as MdastNode : null;
  }
  if (tagName === 'mark' && style) {
    const color = extractCssColorDeclaration(style, 'background-color');
    return color ? createBgColorMdastNode(color, children) as MdastNode : null;
  }
  if (tagName === 'u') {
    return createUnderlineMdastNode(children) as MdastNode;
  }
  return null;
}

export function findClosingHtmlChildIndex(
  startIndex: number,
  tagName: string,
  closeIndexesByTag: Map<string, number[]>,
  childrenLength: number
): number {
  const maxIndex = Math.min(childrenLength - 1, startIndex + MAX_INLINE_HTML_CONTAINER_CHILDREN + 1);
  const closeIndexes = closeIndexesByTag.get(tagName.toLowerCase());
  if (!closeIndexes) {
    return maxIndex < childrenLength - 1 ? INLINE_HTML_CONTAINER_SEARCH_EXCEEDED : -1;
  }

  let left = 0;
  let right = closeIndexes.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (closeIndexes[mid] <= startIndex) left = mid + 1;
    else right = mid;
  }

  const closeIndex = closeIndexes[left];
  if (closeIndex === undefined || closeIndex > maxIndex) {
    return maxIndex < childrenLength - 1 ? INLINE_HTML_CONTAINER_SEARCH_EXCEEDED : -1;
  }

  return closeIndex;
}

export function buildInlineHtmlCloseIndexes(children: readonly MdastNode[]): Map<string, number[]> {
  const closeIndexesByTag = new Map<string, number[]>();
  for (let index = 0; index < children.length; index += 1) {
    const candidate = children[index];
    if (
      candidate.type === 'html' &&
      typeof candidate.value === 'string'
    ) {
      const closeMatch = INLINE_HTML_CLOSE_TAG_PATTERN.exec(candidate.value.trim());
      const tagName = closeMatch?.[1]?.toLowerCase();
      if (!tagName) continue;
      const closeIndexes = closeIndexesByTag.get(tagName);
      if (closeIndexes) closeIndexes.push(index);
      else closeIndexesByTag.set(tagName, [index]);
    }
  }
  return closeIndexesByTag;
}

export function inlineContentContainsRawHtml(nodes: readonly MdastNode[]): boolean {
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.type === 'html') {
      return true;
    }
    if (typeof node.value === 'string' && containsRawHtmlTag(node.value)) {
      return true;
    }
    for (const child of node.children ?? []) {
      stack.push(child);
    }
  }
  return false;
}
