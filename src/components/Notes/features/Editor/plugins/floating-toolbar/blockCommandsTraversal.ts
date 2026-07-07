import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';
import { normalizeTopLevelBlockPos } from '../cursor/topLevelBlockDom';
import {
  MAX_BLOCK_COMMAND_DOM_SELECTION_CHILDREN,
  MAX_BLOCK_COMMAND_SELECTION_SCAN_NODES,
} from './blockCommandsLimits';

export type TraversableNode = {
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

export function forEachBoundedSelectedNode(
  doc: unknown,
  from: number,
  to: number,
  visit: (node: TraversableNode, pos: number, parent?: TraversableNode) => boolean | void,
  maxScanNodes = MAX_BLOCK_COMMAND_SELECTION_SCAN_NODES
) {
  if (!isTraversableNode(doc)) {
    let scanned = 0;
    (doc as { nodesBetween?: (...args: any[]) => void }).nodesBetween?.(from, to, (node: TraversableNode, pos: number, parent?: TraversableNode) => {
      if (scanned >= maxScanNodes) return false;
      scanned += 1;
      return visit(node, pos, parent);
    });
    return;
  }

  let scanned = 0;
  const stack: Array<{
    contentStart: number;
    index: number;
    node: TraversableNode;
    offset: number;
    parent?: TraversableNode;
  }> = [{ contentStart: 0, index: 0, node: doc, offset: 0 }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= (frame.node.childCount ?? 0)) {
      stack.pop();
      continue;
    }
    if (scanned >= maxScanNodes) return;

    const node = frame.node.child!(frame.index);
    const pos = frame.contentStart + frame.offset;
    const nodeSize = getNodeSize(node);
    frame.index += 1;
    frame.offset += nodeSize;

    if (pos >= to) {
      frame.index = frame.node.childCount ?? frame.index;
      continue;
    }
    if (pos + nodeSize <= from) continue;

    scanned += 1;
    const shouldDescend = visit(node, pos, frame.node);
    if (shouldDescend === false || !isTraversableNode(node) || (node.childCount ?? 0) === 0) {
      continue;
    }
    stack.push({ contentStart: pos + 1, index: 0, node, offset: 0, parent: frame.node });
  }
}

export function getHeadingLevel(blockType: BlockType): number | null {
  if (!blockType.startsWith('heading')) return null;
  const level = Number.parseInt(blockType.replace('heading', ''), 10);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : null;
}

export function isTableContainer(typeName: string | undefined): boolean {
  return typeName === 'table_cell' || typeName === 'table_header';
}

export function isConvertibleTextBlock(node: { attrs?: Record<string, unknown>; type?: { name: string } }): node is {
  attrs?: Record<string, unknown>;
  type: { name: string };
} {
  return node.type?.name === 'paragraph' || node.type?.name === 'heading';
}

export function canConvertTextBlockInParent(parentTypeName: string | undefined): boolean {
  return !isTableContainer(parentTypeName);
}

function isInsideTableContainerAtDepth(
  $pos: EditorView['state']['selection']['$from'],
  depth: number
): boolean {
  for (let currentDepth = depth - 1; currentDepth > 0; currentDepth -= 1) {
    if (isTableContainer($pos.node(currentDepth)?.type.name)) return true;
  }
  return false;
}

export function getSelectionBoundaryTextBlock(
  $pos: EditorView['state']['selection']['$from'] | undefined
): { node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number } | null {
  if (!$pos || typeof $pos.depth !== 'number' || typeof $pos.node !== 'function') return null;

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (!isConvertibleTextBlock(node)) continue;
    if (isInsideTableContainerAtDepth($pos, depth)) return null;
    return { node, pos: $pos.before(depth) };
  }
  return null;
}

export function resolveSingleSelectedTextBlock(view: EditorView): { from: number; to: number } | null {
  const { selection } = view.state;
  const fromEntry = getSelectionBoundaryTextBlock(selection.$from);
  const toEntry = getSelectionBoundaryTextBlock('$to' in selection ? selection.$to : undefined);
  if (!fromEntry || !toEntry || fromEntry.pos !== toEntry.pos) return null;

  const node = view.state.doc.nodeAt(fromEntry.pos);
  if (!node || !isConvertibleTextBlock(node)) return null;
  return {
    from: fromEntry.pos + 1,
    to: fromEntry.pos + Math.max(1, node.nodeSize - 1),
  };
}

export function runWithSingleTextBlockSelection(view: EditorView, command: () => void): void {
  const range = resolveSingleSelectedTextBlock(view);
  if (!range || view.state.selection.empty) {
    command();
    return;
  }

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
      .setMeta('addToHistory', false)
  );
  command();
}

export function getDomSelectedTextBlocks(
  view: EditorView
): Array<{ node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number }> {
  if (typeof window === 'undefined' || !(view.dom instanceof HTMLElement)) return [];

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  if (range.collapsed) return [];

  const seen = new Set<number>();
  const entries: Array<{ node: { type: { name: string }; attrs?: Record<string, unknown> }; pos: number }> = [];
  for (let index = 0; index < view.dom.children.length && index < MAX_BLOCK_COMMAND_DOM_SELECTION_CHILDREN; index += 1) {
    const child = view.dom.children.item(index);
    if (!(child instanceof HTMLElement)) continue;

    let intersects = false;
    try {
      intersects = range.intersectsNode(child);
    } catch {
      intersects = false;
    }
    if (!intersects) continue;

    let rawPos: number | null = null;
    try {
      rawPos = view.posAtDOM(child, 0);
    } catch {
      rawPos = null;
    }
    if (rawPos === null) continue;

    const pos = normalizeTopLevelBlockPos(view, rawPos);
    if (pos === null || seen.has(pos)) continue;

    const node = view.state.doc.nodeAt(pos);
    if (!node || !isConvertibleTextBlock(node)) continue;
    seen.add(pos);
    entries.push({ node, pos });
  }

  return entries;
}
