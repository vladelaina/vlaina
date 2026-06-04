import { GITHUB_DROP_WITH_CONTENT_TAGS } from '@/lib/notes/markdown/githubHtmlPolicy';
import { stripGithubDroppedRawHtmlContentFragment } from '@/lib/notes/markdown/githubRawHtml';

interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  children?: HastNode[];
}

function isDroppedRawHtmlElement(node: HastNode): boolean {
  return (
    node.type === 'element' &&
    typeof node.tagName === 'string' &&
    GITHUB_DROP_WITH_CONTENT_TAGS.has(node.tagName.toLowerCase())
  );
}

function sanitizeUnsafeRawHtmlChildren(children: HastNode[]): void {
  let activeTag: string | null = null;
  let index = 0;

  while (index < children.length) {
    const child = children[index];
    if (!child) {
      children.splice(index, 1);
      continue;
    }

    if (activeTag) {
      if (child.type !== 'raw' || typeof child.value !== 'string') {
        children.splice(index, 1);
        continue;
      }

      const result = stripGithubDroppedRawHtmlContentFragment(child.value, activeTag);
      activeTag = result.activeTag;
      if (!result.value) {
        children.splice(index, 1);
        continue;
      }

      child.value = result.value;
      index += 1;
      continue;
    }

    if (child.type === 'raw' && typeof child.value === 'string') {
      const result = stripGithubDroppedRawHtmlContentFragment(child.value);
      activeTag = result.activeTag;
      if (!result.value) {
        children.splice(index, 1);
        continue;
      }

      child.value = result.value;
      index += 1;
      continue;
    }

    if (isDroppedRawHtmlElement(child)) {
      children.splice(index, 1);
      continue;
    }

    index += 1;
  }
}

export function dropUnsafeRawHtmlContent(node: HastNode): void {
  const children = node.children;
  if (!Array.isArray(children)) {
    return;
  }

  sanitizeUnsafeRawHtmlChildren(children);
  for (const child of children) {
    dropUnsafeRawHtmlContent(child);
  }
}

export function rehypeDropUnsafeRawHtmlContent() {
  return (tree: HastNode) => {
    dropUnsafeRawHtmlContent(tree);
  };
}
