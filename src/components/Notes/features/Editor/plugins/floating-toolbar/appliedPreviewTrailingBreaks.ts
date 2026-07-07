import type { Node as ProseMirrorNode } from '@milkdown/kit/prose/model';
import {
  MAX_APPLIED_PREVIEW_TRAILING_BREAK_DEPTH,
  MAX_APPLIED_PREVIEW_TRAILING_BREAK_NODES,
} from './appliedPreviewLimits';

export function addProseMirrorTrailingBreaks(
  previewDom: HTMLElement,
  doc: ProseMirrorNode,
  ownerDocument: Document,
  options: {
    maxDepth?: number;
    maxNodes?: number;
  } = {}
): void {
  addTrailingBreaksForChildren(previewDom, doc, ownerDocument, options);
}

function addTrailingBreaksForChildren(
  container: HTMLElement,
  parentNode: ProseMirrorNode,
  ownerDocument: Document,
  options: {
    maxDepth?: number;
    maxNodes?: number;
  } = {}
): void {
  const maxDepth = options.maxDepth ?? MAX_APPLIED_PREVIEW_TRAILING_BREAK_DEPTH;
  const maxNodes = options.maxNodes ?? MAX_APPLIED_PREVIEW_TRAILING_BREAK_NODES;
  let scanned = 0;
  const stack: Array<{
    container: HTMLElement;
    depth: number;
    index: number;
    node: ProseMirrorNode;
  }> = [{ container, depth: 0, index: 0, node: parentNode }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.node.childCount) {
      stack.pop();
      continue;
    }
    if (scanned >= maxNodes || frame.depth >= maxDepth) {
      return;
    }

    const childIndex = frame.index;
    frame.index += 1;
    const node = frame.node.child(childIndex);
    const child = frame.container.children.item(childIndex);
    scanned += 1;

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (node.isTextblock && node.content.size === 0) {
      if (!hasDirectProseMirrorTrailingBreak(child)) {
        const br = ownerDocument.createElement('br');
        br.className = 'ProseMirror-trailingBreak';
        child.appendChild(br);
      }
      continue;
    }

    if (node.childCount > 0) {
      stack.push({
        container: child,
        depth: frame.depth + 1,
        index: 0,
        node,
      });
    }
  }
}

function hasDirectProseMirrorTrailingBreak(element: HTMLElement): boolean {
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.classList.contains('ProseMirror-trailingBreak')) return true;
  }
  return false;
}
