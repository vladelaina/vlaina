import type { EditorView } from '@milkdown/kit/prose/view';
import { DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT } from '../shared/boundedProseNodeScan';

export const MAX_LIST_CONVERSION_SELECTION_SCAN_NODES = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT;
export const MAX_LIST_CONVERSION_SELECTED_ITEMS = 5_000;

type TraversableNode = {
  attrs?: Record<string, unknown>;
  child?: (index: number) => TraversableNode;
  childCount?: number;
  nodeSize?: number;
  type?: { name: string };
};

function isTraversableNode(value: unknown): value is TraversableNode {
  const node = value as TraversableNode | null | undefined;
  return typeof node?.child === 'function' && typeof node.childCount === 'number';
}

function getNodeSize(node: TraversableNode): number {
  return typeof node.nodeSize === 'number' && Number.isFinite(node.nodeSize) && node.nodeSize > 0
    ? Math.floor(node.nodeSize)
    : 1;
}

function forEachBoundedSelectedNode(
  doc: unknown,
  from: number,
  to: number,
  visit: (node: TraversableNode, pos: number) => boolean | void,
  maxScanNodes = MAX_LIST_CONVERSION_SELECTION_SCAN_NODES
) {
  if (!isTraversableNode(doc)) {
    let scanned = 0;
    (doc as { nodesBetween?: (...args: any[]) => void }).nodesBetween?.(from, to, (node: TraversableNode, pos: number) => {
      if (scanned >= maxScanNodes) return false;
      scanned += 1;
      return visit(node, pos);
    });
    return;
  }

  let scanned = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: TraversableNode;
    offset: number;
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
    const nodeSize = getNodeSize(node);
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
    const shouldDescend = visit(node, pos);
    if (shouldDescend === false || !isTraversableNode(node) || (node.childCount ?? 0) === 0) {
      continue;
    }

    stack.push({
      contentStart: pos + 1,
      index: 0,
      node,
      offset: 0,
    });
  }
}

export function getAncestorEntryAt(
  $pos: EditorView['state']['selection']['$from'] | undefined,
  predicate: (node: any) => boolean
) {
  if (!$pos || typeof $pos.depth !== 'number' || typeof $pos.node !== 'function') {
    return null;
  }

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!predicate(node)) {
      continue;
    }

    return {
      node,
      pos: $pos.before(depth),
    };
  }

  return null;
}

export function collectSelectedListItems(
  view: EditorView
): Array<{ node: { type: { name: string }; attrs: Record<string, unknown> }; pos: number }> {
  const { state } = view;
  const selection = state.selection;
  const targets = new Map<number, { node: { type: { name: string }; attrs: Record<string, unknown> }; pos: number }>();

  const register = (entry: { node: TraversableNode; pos: number } | null) => {
    if (!entry || entry.node.type?.name !== 'list_item' || targets.has(entry.pos)) {
      return;
    }

    targets.set(entry.pos, {
      node: {
        ...entry.node,
        type: entry.node.type,
        attrs: entry.node.attrs ?? {},
      },
      pos: entry.pos,
    });
  };

  register(getAncestorEntryAt(selection.$from, (node) => node.type?.name === 'list_item'));
  register(getAncestorEntryAt('$to' in selection ? selection.$to : undefined, (node) => node.type?.name === 'list_item'));

  if (!selection.empty && state.doc) {
    forEachBoundedSelectedNode(state.doc, selection.from, selection.to, (node, pos) => {
      if (targets.size >= MAX_LIST_CONVERSION_SELECTED_ITEMS) {
        return false;
      }
      if (node.type?.name !== 'list_item') {
        return;
      }

      register({ node, pos });
      return false;
    });
  }

  return Array.from(targets.values()).sort((a, b) => a.pos - b.pos);
}
