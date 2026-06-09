export const DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT = 20_000;
export const SKIP_PROSE_DESCENDANTS = Symbol('skipProseDescendants');
export const STOP_PROSE_SCAN = Symbol('stopProseScan');

export interface BoundedProseScanNode {
  attrs?: Record<string, unknown>;
  child?: (index: number) => BoundedProseScanNode | null | undefined;
  childCount?: number;
  content?: { size?: number };
  forEach?: (callback: (node: BoundedProseScanNode, offset: number, index: number) => void) => void;
  isBlock?: boolean;
  isText?: boolean;
  marks?: readonly { type?: { name?: string } }[];
  nodeSize?: number;
  text?: string | null;
  textContent?: string | null;
  textBetween?: (from: number, to: number, blockSeparator?: string, leafText?: string) => string;
  type?: { name?: string };
}

function getScanChildCount(node: BoundedProseScanNode): number {
  return typeof node.childCount === 'number' && Number.isFinite(node.childCount) && node.childCount > 0
    ? Math.floor(node.childCount)
    : 0;
}

function getScanNodeSize(node: BoundedProseScanNode): number {
  if (typeof node.nodeSize === 'number' && Number.isFinite(node.nodeSize) && node.nodeSize > 0) {
    return Math.floor(node.nodeSize);
  }
  if (node.isText && typeof node.text === 'string') {
    return node.text.length;
  }
  if (typeof node.content?.size === 'number' && Number.isFinite(node.content.size) && node.content.size >= 0) {
    return Math.floor(node.content.size) + 2;
  }
  return 1;
}

export function scanProseDescendants(
  root: BoundedProseScanNode,
  visit: (
    node: BoundedProseScanNode,
    pos: number,
    parent: BoundedProseScanNode,
    index: number,
  ) => typeof SKIP_PROSE_DESCENDANTS | typeof STOP_PROSE_SCAN | boolean | void,
  maxNodes = DEFAULT_PROSE_DOC_SCAN_NODE_LIMIT,
): boolean {
  let scanned = 0;
  const stack: Array<{
    childCount: number;
    index: number;
    nextPos: number;
    node: BoundedProseScanNode;
  }> = [{
    childCount: getScanChildCount(root),
    index: 0,
    nextPos: 0,
    node: root,
  }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.childCount) {
      stack.pop();
      continue;
    }

    if (scanned >= maxNodes) {
      return false;
    }

    const index = frame.index;
    const node = frame.node.child?.(index) as BoundedProseScanNode | null | undefined;
    const pos = frame.nextPos;
    frame.index += 1;
    if (!node) continue;

    frame.nextPos += getScanNodeSize(node);
    scanned += 1;

    const action = visit(node, pos, frame.node, index);
    if (action === STOP_PROSE_SCAN) {
      return true;
    }

    const childCount = getScanChildCount(node);
    if (action !== SKIP_PROSE_DESCENDANTS && action !== false && childCount > 0 && typeof node.child === 'function') {
      stack.push({
        childCount,
        index: 0,
        nextPos: pos + 1,
        node,
      });
    }
  }

  return true;
}
