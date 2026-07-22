const MAX_KATEX_SOURCE_HTML_CHARS = 2 * 1024 * 1024;
const MAX_KATEX_SOURCE_HTML_DEPTH = 200;
const MAX_KATEX_SOURCE_HTML_NODES = 20_000;
const KATEX_SOURCE_ANNOTATION_PATTERN =
  /<annotation\b(?=[^>]*\bencoding\s*=\s*(?:"application\/x-tex"|'application\/x-tex'|application\/x-tex(?:[\s/>]|$)))[^>]*>[\s\S]*?<\/annotation>/gi;
const KATEX_SOURCE_ANNOTATION_MARKER_PATTERN = /application\/x-tex/i;

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
