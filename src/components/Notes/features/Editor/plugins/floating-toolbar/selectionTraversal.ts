import type { EditorView } from '@milkdown/kit/prose/view';
import {
  MAX_FLOATING_TOOLBAR_SELECTION_SCAN_NODES,
  RESTRICTED_SELECTION_BLOCK_TYPES,
} from './selectionHelperConstants';
import type {
  NodeWithTypeAndAttrs,
  SelectedTextContext,
  TextNodeLike,
  TraversableNode,
} from './selectionHelperTypes';

function isTraversableNode(value: unknown): value is TraversableNode {
  const node = value as TraversableNode | null | undefined;
  return typeof node?.child === 'function' && typeof node.childCount === 'number';
}

function forEachSelectedNode(
  doc: unknown,
  from: number,
  to: number,
  callback: (node: unknown, pos: number, parent?: unknown) => void,
  maxScanNodes = MAX_FLOATING_TOOLBAR_SELECTION_SCAN_NODES
) {
  if (!isTraversableNode(doc)) {
    let scanned = 0;
    (doc as { nodesBetween?: (...args: any[]) => void }).nodesBetween?.(from, to, (node: unknown, pos: number, parent?: unknown) => {
      if (scanned >= maxScanNodes) return false;
      scanned += 1;
      callback(node, pos, parent);
      return undefined;
    });
    return;
  }

  let scanned = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: TraversableNode;
    offset: number;
    parent?: unknown;
  }> = [{
    contentStart: 0,
    index: 0,
    node: doc,
    offset: 0,
  }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= (frame.node.childCount ?? 0)) {
      stack.pop();
      continue;
    }
    if (scanned >= maxScanNodes) {
      return;
    }

    const node = frame.node.child!(frame.index);
    const pos = frame.contentStart + frame.offset;
    const nodeSize = typeof node.nodeSize === 'number' && node.nodeSize > 0 ? node.nodeSize : 1;
    frame.index += 1;
    frame.offset += nodeSize;

    if (pos >= to) {
      frame.index = frame.node.childCount ?? frame.index;
      continue;
    }
    if (pos + nodeSize <= from) {
      continue;
    }

    scanned += 1;
    callback(node, pos, frame.node);

    if (isTraversableNode(node) && (node.childCount ?? 0) > 0) {
      stack.push({
        contentStart: pos + 1,
        index: 0,
        node,
        offset: 0,
        parent: frame.node,
      });
    }
  }
}

export function forEachSelectedTextNode(
  view: EditorView,
  callback: (context: SelectedTextContext) => void,
  options?: { excludeRestrictedParents?: boolean }
): boolean {
  const { state } = view;
  const { from, to, empty } = state.selection;
  let hasSelectedText = false;

  if (empty) {
    return false;
  }

  forEachSelectedNode(state.doc, from, to, (node, pos, parent) => {
    const textNode = node as unknown as TextNodeLike;
    const parentNode = parent as NodeWithTypeAndAttrs | undefined;
    if (
      options?.excludeRestrictedParents &&
      parentNode &&
      RESTRICTED_SELECTION_BLOCK_TYPES.has(parentNode.type.name)
    ) {
      return;
    }

    if (!textNode.isText || !textNode.text || textNode.text.length === 0) {
      return;
    }

    const nodeStart = pos;
    const nodeEnd = pos + textNode.nodeSize;
    const selectedStart = Math.max(from, nodeStart);
    const selectedEnd = Math.min(to, nodeEnd);

    if (selectedStart >= selectedEnd) {
      return;
    }

    hasSelectedText = true;
    callback({
      node: textNode,
      pos,
      selectedFrom: selectedStart,
      selectedTo: selectedEnd,
    });
  });

  return hasSelectedText;
}
