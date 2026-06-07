import {
  everyTextNodeHasMark,
  getCombinedClass,
  getTextContent,
  getVlookAccentTokenFromNode,
  type DecorationAttrs,
} from '../typoraTextSemantics';

function imageSourceHasFragment(node: any, fragment: string): boolean {
  return node.type?.name === 'image' &&
    typeof node.attrs?.src === 'string' &&
    node.attrs.src.toLowerCase().includes(fragment);
}

function nodeContainsImageFragment(node: any, fragment: string): boolean {
  let matched = false;
  node.descendants?.((child: any) => {
    if (imageSourceHasFragment(child, fragment)) {
      matched = true;
      return false;
    }
    return true;
  });
  return matched;
}

function nodeContainsPostCardImage(node: any): boolean {
  return nodeContainsImageFragment(node, '#card');
}

function nodeContainsDualPostCardImage(node: any): boolean {
  return nodeContainsImageFragment(node, '#cardd');
}

export function getBlockquoteAttrs(node: any): DecorationAttrs | null {
  if (node.type?.name !== 'blockquote') return null;
  const accentToken = getVlookAccentTokenFromNode(node);
  const isEmphasized = everyTextNodeHasMark(node, 'emphasis');
  const hasPostCardImage = nodeContainsPostCardImage(node);
  const hasDualPostCardImage = hasPostCardImage && nodeContainsDualPostCardImage(node);
  const className = getCombinedClass(
    accentToken,
    isEmphasized ? 'em' : null,
    hasPostCardImage ? 'v-post-card' : null,
    hasPostCardImage ? 'vlook-post-card' : null,
    hasDualPostCardImage ? 'vlook-post-card-dual' : null
  );
  return className ? { class: className } : null;
}

export function getPostCardChildAttrs(node: any, parent: any): DecorationAttrs | null {
  if (parent?.type?.name !== 'blockquote' || !nodeContainsPostCardImage(parent)) {
    return null;
  }
  if (node.type?.name !== 'paragraph') return null;
  if (nodeContainsPostCardImage(node)) {
    return { class: 'v-card-image' };
  }
  if (everyTextNodeHasMark(node, 'strong')) {
    return { class: 'v-card-title' };
  }
  if (getTextContent(node).trim()) {
    return { class: 'v-card-text' };
  }
  return null;
}
