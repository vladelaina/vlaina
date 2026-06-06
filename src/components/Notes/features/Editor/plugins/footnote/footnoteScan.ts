export const MAX_SYNCED_FOOTNOTE_REFS = 1000;
export const MAX_SYNCED_FOOTNOTE_DEFS = 1000;
export const MAX_FOOTNOTE_DOM_SCAN_ELEMENTS = 20_000;
export const MAX_FOOTNOTE_DOC_SCAN_NODES = 20_000;

interface FootnoteScanNode {
  type?: { name?: string };
  childCount?: number;
  child?: (index: number) => FootnoteScanNode;
  descendants?: (callback: (node: FootnoteScanNode) => boolean | void) => void;
}

interface FootnoteScanResult {
  found: boolean;
  exhausted: boolean;
}

export function isFootnoteReferenceNodeName(nodeName: string): boolean {
  return nodeName === 'footnote_reference' || nodeName === 'footnote_ref';
}

export function isFootnoteDefinitionNodeName(nodeName: string): boolean {
  return nodeName === 'footnote_definition' || nodeName === 'footnote_def';
}

export function isFootnoteDefinitionElement(element: HTMLElement): boolean {
  return element.classList.contains('footnote-def') && (element.hasAttribute('data-id') || element.hasAttribute('data-label'));
}

export function isFootnoteReferenceElement(element: HTMLElement): boolean {
  return element.classList.contains('footnote-ref') && (element.hasAttribute('data-id') || element.hasAttribute('data-label'));
}

export function collectFootnoteElements(
  root: HTMLElement,
  predicate: (element: HTMLElement) => boolean,
  maxMatches: number,
  maxScanned = MAX_FOOTNOTE_DOM_SCAN_ELEMENTS
): HTMLElement[] {
  const matches: HTMLElement[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 1);
  let scanned = 0;
  let node = walker.nextNode();

  while (node) {
    if (node instanceof HTMLElement) {
      scanned += 1;
      if (scanned > maxScanned) break;
      if (predicate(node)) {
        matches.push(node);
        if (matches.length >= maxMatches) break;
      }
    }
    node = walker.nextNode();
  }

  return matches;
}

function getFootnoteScanChildCount(node: FootnoteScanNode): number {
  return typeof node.childCount === 'number' && Number.isFinite(node.childCount) && node.childCount > 0
    ? Math.floor(node.childCount)
    : 0;
}

export function scanFootnoteNodes(root: FootnoteScanNode, maxNodes = MAX_FOOTNOTE_DOC_SCAN_NODES): FootnoteScanResult {
  if (typeof root.child === 'function') {
    let scanned = 0;
    const stack: Array<{ node: FootnoteScanNode; index: number; childCount: number }> = [{
      node: root,
      index: 0,
      childCount: getFootnoteScanChildCount(root),
    }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.childCount) {
        stack.pop();
        continue;
      }

      if (scanned >= maxNodes) {
        return { found: false, exhausted: true };
      }

      const nextNode = frame.node.child?.(frame.index);
      frame.index += 1;
      if (!nextNode) continue;

      scanned += 1;
      const nodeName = nextNode.type?.name;
      if (nodeName && (isFootnoteReferenceNodeName(nodeName) || isFootnoteDefinitionNodeName(nodeName))) {
        return { found: true, exhausted: false };
      }

      const nextChildCount = getFootnoteScanChildCount(nextNode);
      if (nextChildCount > 0 && typeof nextNode.child === 'function') {
        stack.push({ node: nextNode, index: 0, childCount: nextChildCount });
      }
    }

    return { found: false, exhausted: false };
  }

  let found = false;
  let exhausted = false;
  let scanned = 0;
  root.descendants?.((node) => {
    if (found || exhausted) return false;
    scanned += 1;
    if (scanned > maxNodes) {
      exhausted = true;
      return false;
    }
    const nodeName = node.type?.name;
    if (nodeName && (isFootnoteReferenceNodeName(nodeName) || isFootnoteDefinitionNodeName(nodeName))) {
      found = true;
      return false;
    }
    return true;
  });

  return { found, exhausted };
}

export function docHasFootnoteNodes(doc: FootnoteScanNode, maxNodes = MAX_FOOTNOTE_DOC_SCAN_NODES): boolean {
  const result = scanFootnoteNodes(doc, maxNodes);
  return result.found || result.exhausted;
}

export function stepSliceContainsFootnote(step: unknown): boolean {
  const content = (step as {
    slice?: {
      content?: FootnoteScanNode;
    };
  }).slice?.content;
  if (!content || (typeof content.child !== 'function' && typeof content.descendants !== 'function')) {
    return false;
  }

  const result = scanFootnoteNodes(content);
  return result.found || result.exhausted;
}
