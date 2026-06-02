interface HastNode {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

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
  if (!html.includes('application/x-tex')) {
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
  template.content.querySelectorAll('annotation').forEach((annotation) => {
    if (annotation.getAttribute('encoding')?.toLowerCase() === 'application/x-tex') {
      annotation.remove();
    }
  });
  return template.innerHTML;
}

export function removeKatexSourceAnnotationsFromHast(node: HastNode): void {
  const children = node.children;
  if (!Array.isArray(children)) {
    return;
  }

  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (!child) {
      continue;
    }
    if (isKatexSourceAnnotation(child)) {
      children.splice(index, 1);
      continue;
    }
    removeKatexSourceAnnotationsFromHast(child);
  }
}

export function rehypeKatexSourceSanitizer() {
  return (tree: HastNode) => {
    removeKatexSourceAnnotationsFromHast(tree);
  };
}
