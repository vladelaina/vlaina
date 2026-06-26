export interface EmptyParagraphDeleteResolvedPos {
  posAtIndex: (index: number, depth?: number) => number;
  depth: number;
  parent: {
    isTextblock: boolean;
  };
  before: (depth?: number) => number;
  after: (depth?: number) => number;
  node: (depth: number) => EmptyParagraphDeleteNode;
  index: (depth: number) => number;
}

export interface EmptyParagraphDeleteSelection {
  empty: boolean;
  $from: EmptyParagraphDeleteResolvedPos;
}

export interface EmptyParagraphDeleteState {
  selection: EmptyParagraphDeleteSelection;
}

export interface EmptyParagraphDeleteNode {
  type: {
    name: string;
  };
  nodeSize: number;
  childCount: number;
  child: (index: number) => EmptyParagraphDeleteNode;
  isLeaf?: boolean;
  isText?: boolean;
  text?: string | null;
}

export interface AdjacentEmptyParagraphDeleteRange {
  from: number;
  to: number;
  searchDir: -1 | 1;
  blockFrom: number;
  blockTo: number;
  blockName: string;
}

export function isNodeContentEffectivelyEmpty(
  node: EmptyParagraphDeleteNode | null | undefined
): boolean {
  if (!node) return true;

  if (node.isText) {
    return (node.text ?? '').replace(/\u200B/g, '').trim().length === 0;
  }

  if (node.type.name === 'hard_break') {
    return true;
  }

  if (node.isLeaf) {
    return false;
  }

  for (let index = 0; index < node.childCount; index += 1) {
    if (!isNodeContentEffectivelyEmpty(node.child(index))) {
      return false;
    }
  }

  return true;
}

export function findAdjacentEmptyParagraphNearBlockDeleteRange(
  state: EmptyParagraphDeleteState,
  searchDir: -1 | 1,
  blockNames: ReadonlySet<string>
): AdjacentEmptyParagraphDeleteRange | null {
  const { selection } = state;
  if (!selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock) return null;

  const paragraphDepth = $from.depth;
  if (paragraphDepth !== 1) return null;

  const paragraph = $from.node(paragraphDepth);
  if (paragraph.type.name !== 'paragraph' || !isNodeContentEffectivelyEmpty(paragraph)) {
    return null;
  }

  const containerDepth = paragraphDepth - 1;
  const container = $from.node(containerDepth);
  const paragraphIndex = $from.index(containerDepth);
  const blockIndex = paragraphIndex + (searchDir < 0 ? -1 : 1);

  if (blockIndex < 0 || blockIndex >= container.childCount) {
    return null;
  }

  const block = container.child(blockIndex);
  if (!blockNames.has(block.type.name)) {
    return null;
  }

  const blockFrom = $from.posAtIndex(blockIndex, containerDepth);

  return {
    from: $from.before(paragraphDepth),
    to: $from.after(paragraphDepth),
    searchDir,
    blockFrom,
    blockTo: blockFrom + block.nodeSize,
    blockName: block.type.name,
  };
}
