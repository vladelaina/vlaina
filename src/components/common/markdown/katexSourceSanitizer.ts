interface HastNode {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const MAX_KATEX_SOURCE_HAST_DEPTH = 200;
const MAX_KATEX_SOURCE_HAST_NODES = 20_000;
const MAX_KATEX_SOURCE_HTML_CHARS = 2 * 1024 * 1024;
const MAX_KATEX_SOURCE_HTML_DEPTH = 200;
const MAX_KATEX_SOURCE_HTML_NODES = 20_000;
const MAX_KATEX_SOURCE_ENCODING_CHARS = 128;
const KATEX_SOURCE_ANNOTATION_PATTERN =
  /<annotation\b(?=[^>]*\bencoding\s*=\s*(?:"application\/x-tex"|'application\/x-tex'|application\/x-tex(?:[\s/>]|$)))[^>]*>[\s\S]*?<\/annotation>/gi;
const KATEX_SOURCE_ANNOTATION_MARKER_PATTERN = /application\/x-tex/i;

function readPropertyString(properties: Record<string, unknown> | undefined, name: string) {
  const value = properties?.[name];
  if (typeof value === 'string') {
    return value.length <= MAX_KATEX_SOURCE_ENCODING_CHARS ? value : '';
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    let length = 0;
    for (const item of value) {
      if (typeof item !== 'string') continue;
      length += item.length + (parts.length > 0 ? 1 : 0);
      if (length > MAX_KATEX_SOURCE_ENCODING_CHARS) return '';
      parts.push(item);
    }
    return parts.join(' ');
  }
  return '';
}

function isKatexSourceAnnotation(node: HastNode) {
  return (
    node.type === 'element' &&
    node.tagName === 'annotation' &&
    readPropertyString(node.properties, 'encoding').toLowerCase() === 'application/x-tex'
  );
}

export function removeKatexSourceAnnotationsFromHtml(html: string) {
  if (!KATEX_SOURCE_ANNOTATION_MARKER_PATTERN.test(html)) {
    return html;
  }

  if (html.length > MAX_KATEX_SOURCE_HTML_CHARS || typeof document === 'undefined') {
    return html.replace(KATEX_SOURCE_ANNOTATION_PATTERN, '');
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  if (!removeKatexSourceAnnotationsFromDom(template.content)) {
    return html.replace(KATEX_SOURCE_ANNOTATION_PATTERN, '');
  }
  return template.innerHTML;
}

function removeKatexSourceAnnotationsFromDom(root: DocumentFragment): boolean {
  const stack: Array<{ node: Node; depth: number }> = [{ node: root, depth: 0 }];
  let discoveredNodes = 1;

  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: Node; depth: number };
    if (depth >= MAX_KATEX_SOURCE_HTML_DEPTH) {
      if (node.hasChildNodes()) {
        return false;
      }
      continue;
    }

    for (let child = node.lastChild; child;) {
      const previousSibling = child.previousSibling;
      discoveredNodes += 1;
      if (discoveredNodes > MAX_KATEX_SOURCE_HTML_NODES) {
        return false;
      }

      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName.toLowerCase() === 'annotation' &&
        (child as Element).getAttribute('encoding')?.toLowerCase() === 'application/x-tex'
      ) {
        child.parentNode?.removeChild(child);
        child = previousSibling;
        continue;
      }
      stack.push({ node: child, depth: depth + 1 });
      child = previousSibling;
    }
  }

  return true;
}

export function removeKatexSourceAnnotationsFromHast(node: HastNode): void {
  const queue: Array<{ node: HastNode; depth: number }> = [{ node, depth: 0 }];
  let visitedNodes = 1;

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex];
    const children = current.node.children;
    if (!Array.isArray(children)) {
      continue;
    }

    if (current.depth >= MAX_KATEX_SOURCE_HAST_DEPTH) {
      current.node.children = [];
      continue;
    }

    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      const child = children[childIndex];
      if (!child || isKatexSourceAnnotation(child)) {
        children.splice(childIndex, 1);
      }
    }

    for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
      const child = children[childIndex];
      if (!child) {
        continue;
      }

      visitedNodes += 1;
      if (visitedNodes > MAX_KATEX_SOURCE_HAST_NODES) {
        children.splice(childIndex);
        break;
      }

      queue.push({ node: child, depth: current.depth + 1 });
    }
  }
}

export function rehypeKatexSourceSanitizer() {
  return (tree: HastNode) => {
    removeKatexSourceAnnotationsFromHast(tree);
  };
}
