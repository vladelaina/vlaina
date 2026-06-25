import { Selection, TextSelection } from '@milkdown/kit/prose/state';

const MARKDOWN_BLANK_LINE_VALUE = '<!--vlaina-markdown-blank-line-->';
const RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE = '<!--vlaina-rendered-html-boundary-blank-line-->';

export function findInsertedNodePos(args: {
  doc: { content: { size: number }; nodesBetween: (...args: any[]) => void; nodeAt: (pos: number) => any };
  preferredPos: number;
  nodeTypeName: string;
}) {
  const { doc, preferredPos, nodeTypeName } = args;
  const directNode = doc.nodeAt(preferredPos);
  if (directNode?.type?.name === nodeTypeName) {
    return preferredPos;
  }

  let nodePos = -1;
  const from = Math.max(0, preferredPos - 2);
  const to = Math.min(doc.content.size, preferredPos + 4);
  doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (nodePos >= 0) return false;
    if (node.type?.name === nodeTypeName) {
      nodePos = pos;
      return false;
    }
    return undefined;
  });

  return nodePos >= 0 ? nodePos : preferredPos;
}

function isMarkdownBlankLineBlock(node: any): boolean {
  return node?.type?.name === 'html_block' && (
    node.attrs?.value === MARKDOWN_BLANK_LINE_VALUE ||
    node.attrs?.value === RENDERED_HTML_BOUNDARY_BLANK_LINE_VALUE
  );
}

function setTextSelectionSafely(tr: any, pos: number) {
  const safePos = Math.max(0, Math.min(pos, tr.doc.content.size));
  try {
    return tr.setSelection(TextSelection.create(tr.doc, safePos));
  } catch {
    try {
      return tr.setSelection(Selection.near(tr.doc.resolve(safePos), 1));
    } catch {
      return tr;
    }
  }
}

export function moveSelectionAfterInsertedNode(args: {
  tr: any;
  nodePos: number;
  insertedNodeFallback?: { nodeSize?: number; isInline?: boolean } | null;
  paragraphType?: { create: () => any } | null;
}) {
  const { tr, nodePos, insertedNodeFallback, paragraphType } = args;
  if (nodePos < 0 || !tr?.doc || typeof tr.doc.nodeAt !== 'function') {
    return tr;
  }

  const insertedNode = tr.doc.nodeAt(nodePos) ?? insertedNodeFallback;
  const nodeSize = insertedNode?.nodeSize;
  if (typeof nodeSize !== 'number' || nodeSize <= 0) {
    return tr;
  }

  const afterNodePos = nodePos + nodeSize;
  if (insertedNode?.isInline) {
    return setTextSelectionSafely(tr, afterNodePos);
  }

  const nextNode = tr.doc.nodeAt(afterNodePos);
  if (nextNode?.isTextblock) {
    return setTextSelectionSafely(tr, afterNodePos + 1);
  }

  if (isMarkdownBlankLineBlock(nextNode)) {
    const afterBlankLinePos = Math.min(
      afterNodePos + Math.max(1, nextNode.nodeSize ?? 1),
      tr.doc.content.size
    );
    try {
      const selection = Selection.findFrom(tr.doc.resolve(afterBlankLinePos), 1, true)
        ?? Selection.findFrom(tr.doc.resolve(afterBlankLinePos), -1, true);
      return selection ? tr.setSelection(selection) : tr;
    } catch {
      return tr;
    }
  }

  if (paragraphType) {
    try {
      tr.insert(afterNodePos, paragraphType.create());
      return setTextSelectionSafely(tr, afterNodePos + 1);
    } catch {
    }
  }

  try {
    return tr.setSelection(Selection.near(tr.doc.resolve(Math.min(afterNodePos, tr.doc.content.size)), 1));
  } catch {
    return tr;
  }
}
