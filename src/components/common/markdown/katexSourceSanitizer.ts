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

function readPropertyString(properties: Record<string, unknown> | undefined, name: string) {
  const value = properties?.[name];
  if (Array.isArray(value)) {
    return value.join(' ');
  }
  return value == null ? '' : String(value);
}

function isKatexSourceAnnotation(node: HastNode) {
  return (
    node.type === 'element' &&
    node.tagName === 'annotation' &&
    readPropertyString(node.properties, 'encoding').toLowerCase() === 'application/x-tex'
  );
}

export function removeKatexSourceAnnotationsFromHtml(html: string) {
  if (html.length > MAX_KATEX_SOURCE_HTML_CHARS || !html.includes('application/x-tex')) {
    return html;
  }

  if (typeof document === 'undefined') {
    return html.replace(
      /<annotation\b(?=[^>]*\bencoding=(["'])application\/x-tex\1)[^>]*>[\s\S]*?<\/annotation>/gi,
      ''
    );
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  removeKatexSourceAnnotationsFromDom(template.content);
  return template.innerHTML;
}

function removeKatexSourceAnnotationsFromDom(root: DocumentFragment): void {
  const stack: Array<{ node: Node; depth: number }> = [{ node: root, depth: 0 }];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const { node, depth } = stack.pop() as { node: Node; depth: number };
    visitedNodes += 1;
    if (visitedNodes > MAX_KATEX_SOURCE_HTML_NODES) {
      return;
    }

    if (depth >= MAX_KATEX_SOURCE_HTML_DEPTH) {
      continue;
    }

    for (let child = node.lastChild; child; child = child.previousSibling) {
      if (
        child.nodeType === Node.ELEMENT_NODE &&
        (child as Element).tagName.toLowerCase() === 'annotation' &&
        (child as Element).getAttribute('encoding')?.toLowerCase() === 'application/x-tex'
      ) {
        child.parentNode?.removeChild(child);
        continue;
      }
      stack.push({ node: child, depth: depth + 1 });
    }
  }
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
