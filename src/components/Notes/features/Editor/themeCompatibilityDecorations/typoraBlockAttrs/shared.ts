import { getTextContent } from '../typoraTextSemantics';

export function isEmptyParagraphNode(node: any): boolean {
  return node?.type?.name === 'paragraph' && getTextContent(node).trim() === '';
}

export function isInternalBlankLineHtmlBlock(node: any): boolean {
  return node?.type?.name === 'html_block' &&
    typeof node.attrs?.value === 'string' &&
    node.attrs.value.trim() === '<!--vlaina-markdown-blank-line-->';
}

export function isIgnorableVlookLayoutSibling(node: any): boolean {
  return isEmptyParagraphNode(node) || isInternalBlankLineHtmlBlock(node);
}

export function isHrNode(node: any): boolean {
  return node?.type?.name === 'hr';
}

export function getNextContentSibling(parent: any, index: number | undefined): any | null {
  if (!parent || typeof index !== 'number' || typeof parent.child !== 'function') return null;
  for (let nextIndex = index + 1; nextIndex < parent.childCount; nextIndex += 1) {
    const sibling = parent.child(nextIndex);
    if (isIgnorableVlookLayoutSibling(sibling)) continue;
    return sibling;
  }
  return null;
}

export function getPreviousContentSiblingEntry(
  parent: any,
  index: number | undefined
): { node: any; index: number } | null {
  if (!parent || typeof index !== 'number' || typeof parent.child !== 'function') return null;
  for (let prevIndex = index - 1; prevIndex >= 0; prevIndex -= 1) {
    const sibling = parent.child(prevIndex);
    if (isIgnorableVlookLayoutSibling(sibling)) continue;
    return { node: sibling, index: prevIndex };
  }
  return null;
}

export function getNextContentSiblingEntry(
  parent: any,
  index: number | undefined
): { node: any; index: number } | null {
  if (!parent || typeof index !== 'number' || typeof parent.child !== 'function') return null;
  for (let nextIndex = index + 1; nextIndex < parent.childCount; nextIndex += 1) {
    const sibling = parent.child(nextIndex);
    if (isIgnorableVlookLayoutSibling(sibling)) continue;
    return { node: sibling, index: nextIndex };
  }
  return null;
}
