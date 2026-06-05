import { TextSelection, type EditorState } from '@milkdown/kit/prose/state';
import { Fragment, type Slice } from '@milkdown/kit/prose/model';
import { CellSelection } from '@milkdown/kit/prose/tables';
import type { Serializer } from '@milkdown/kit/transformer';

import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
  normalizeSerializedMarkdownSelection,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeSliceToText } from './serializer';
import {
  isVisiblePlainTextSlice,
  serializeSliceAsVisiblePlainText,
} from './visibleTextSerialization';
import { serializeLeadingFrontmatterMarkdown } from '../frontmatter/frontmatterMarkdown';
import {
  MAX_CLIPBOARD_SERIALIZATION_NODES,
  consumeClipboardTraversalNode,
  createClipboardTraversalBudget,
  getProseNodeChildren,
  type ClipboardTraversalBudget,
} from './clipboardTraversalBudget';

type SelectionWithContent = EditorState['selection'] & {
  content?: () => Slice;
};

function isListContainerNode(node: any): boolean {
  return node?.type?.name === 'bullet_list' || node?.type?.name === 'ordered_list';
}

function isTextSelectionLike(selection: EditorState['selection']): boolean {
  if (typeof TextSelection === 'function' && selection instanceof TextSelection) {
    return true;
  }

  return selection.constructor?.name === 'TextSelection';
}

function shouldCopyTextSelectionAsPlainText(state: EditorState, slice: Slice): boolean {
  if (!isTextSelectionLike(state.selection)) return false;
  if (state.selection.empty) return false;
  if (hasEmptySelectedTextblock(slice)) return false;

  return isVisiblePlainTextSlice(slice);
}

function hasEmptySelectedTextblock(slice: Slice): boolean {
  const budget = createClipboardTraversalBudget();
  const stack = getProseNodeChildren({ content: slice.content })
    .map((node) => ({ node, depth: 0 }));

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (!consumeClipboardTraversalNode(budget, depth)) {
      return true;
    }

    if (node.isTextblock && node.content.size === 0) {
      return true;
    }

    const children = getProseNodeChildren(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], depth: depth + 1 });
    }
  }

  return false;
}

function isCellSelectionLike(selection: EditorState['selection']): boolean {
  if (typeof CellSelection === 'function' && selection instanceof CellSelection) {
    return true;
  }

  return selection.constructor?.name === 'CellSelection';
}

function serializeSingleSelectedCellContent(state: EditorState): string | null {
  const selection = state.selection as EditorState['selection'] & {
    $anchorCell?: { pos: number };
    $headCell?: { pos: number };
  };

  if (!isCellSelectionLike(selection)) return null;
  if (!selection.$anchorCell || !selection.$headCell) return null;
  if (selection.$anchorCell.pos !== selection.$headCell.pos) return null;

  const cell = state.doc.nodeAt(selection.$anchorCell.pos);
  if (!cell) return null;

  const cellName = cell?.type?.name;
  if (cellName !== 'table_cell' && cellName !== 'table_header') return null;

  return normalizeSerializedMarkdownSelection(
    serializeSliceToText({ content: cell.content })
  );
}

function serializeSingleCellTableSlice(slice: Slice): string | null {
  const topLevelNodes = getProseNodeChildren({ content: slice.content });
  if (topLevelNodes.length !== 1) return null;

  const table = topLevelNodes[0];
  if (table?.type?.name !== 'table') return null;

  const rows = getProseNodeChildren(table);
  if (rows.length !== 1) return null;

  const cells = getProseNodeChildren(rows[0]);
  if (cells.length !== 1) return null;

  const cell = cells[0];
  const cellName = cell?.type?.name;
  if (cellName !== 'table_cell' && cellName !== 'table_header') return null;

  return normalizeSerializedMarkdownSelection(
    serializeSliceToText({ content: cell.content })
  );
}

function isParagraphOnlyListItem(node: any): boolean {
  if (node?.type?.name !== 'list_item') {
    return false;
  }

  const children = getProseNodeChildren(node);
  return children.length === 1 && children[0]?.type?.name === 'paragraph';
}

function resolveSingleParagraphListItemDescendant(node: any): any | null {
  let resolved: any | null = null;
  const budget = createClipboardTraversalBudget();
  const stack = [{ node, depth: 0 }];

  while (stack.length > 0) {
    const { node: current, depth } = stack.pop()!;
    if (!consumeClipboardTraversalNode(budget, depth)) {
      return null;
    }
    if (!current) continue;
    if (isParagraphOnlyListItem(current)) {
      if (resolved) {
        return null;
      }
      resolved = current;
      continue;
    }

    const children = getProseNodeChildren(current);
    if (
      current.type?.name === 'list_item' &&
      children.some((child) => child.type?.name === 'paragraph' && child.content?.size > 0)
    ) {
      return null;
    }

    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], depth: depth + 1 });
    }
  }

  return resolved;
}

function serializeSingleListItemWithoutMarker(slice: Slice): string | null {
  const listItem = resolveSingleParagraphListItemDescendant({ content: slice.content });
  if (!listItem) {
    return null;
  }

  const itemChildren = getProseNodeChildren(listItem);
  if (itemChildren.length !== 1 || itemChildren[0]?.type?.name !== 'paragraph') {
    return null;
  }

  const selectedText = normalizeSerializedMarkdownSelection(serializeSliceToText(slice));
  if (selectedText.length > 0) {
    return selectedText;
  }

  return normalizeSerializedMarkdownSelection(
    serializeSliceToText({
      content: {
        forEach(callback: (node: any) => void) {
          itemChildren.forEach(callback);
        },
      },
    })
  );
}

function serializeSliceTopLevelBlocks(
  state: EditorState,
  slice: Slice,
  markdownSerializer: Serializer
): string | null {
  const topLevelNodes = getProseNodeChildren({ content: slice.content });
  if (topLevelNodes.length === 0 || topLevelNodes.length > MAX_CLIPBOARD_SERIALIZATION_NODES) {
    return null;
  }

  try {
    const markdownPieces = topLevelNodes.map((node) => {
      const doc = state.schema.topNodeType.createAndFill(undefined, Fragment.from(node));
      if (!doc) {
        throw new Error('unable to create doc for slice node');
      }
      return normalizeSerializedMarkdownBlock(markdownSerializer(doc));
    });

    return joinSerializedBlocks(markdownPieces);
  } catch {
    return null;
  }
}

function findCommonListContainerDepth(state: EditorState): number | null {
  const { $from, $to } = state.selection;
  if (!$from || !$to) {
    return null;
  }

  let sharedDepth = Math.min($from.depth, $to.depth);
  while (sharedDepth > 0 && $from.node(sharedDepth) !== $to.node(sharedDepth)) {
    sharedDepth -= 1;
  }

  for (let depth = sharedDepth; depth > 0; depth -= 1) {
    if (isListContainerNode($from.node(depth))) {
      return depth;
    }
  }

  return null;
}

function serializeBoundarySelectedListItemsWithMarkdown(
  state: EditorState,
  markdownSerializer: Serializer
): string | null {
  const listDepth = findCommonListContainerDepth(state);
  if (listDepth === null) {
    return null;
  }

  const listNode = state.selection.$from.node(listDepth);
  const listStart = state.selection.$from.before(listDepth);
  const { selectedItems, startsAtSelectedItemBoundary } =
    collectListItemsWithSelectedOwnContent(state, listNode, listStart);

  if (selectedItems.length === 0 || (selectedItems.length === 1 && !startsAtSelectedItemBoundary)) {
    return null;
  }

  const selectedList = listNode.type.create(
    { ...listNode.attrs, spread: false },
    selectedItems
  );
  const doc = state.schema.topNodeType.createAndFill(undefined, selectedList);
  if (!doc) {
    return null;
  }

  return normalizeSerializedMarkdownSelection(markdownSerializer(doc));
}

function collectListItemsWithSelectedOwnContent(
  state: EditorState,
  listNode: any,
  listStart: number
): { selectedItems: any[]; startsAtSelectedItemBoundary: boolean } {
  const selectedItems: any[] = [];
  let startsAtSelectedItemBoundary = false;
  const budget = createClipboardTraversalBudget();
  const stack: Array<{ node: any; nodeStart: number; depth: number }> = [];

  const pushChildren = (node: any, parentStart: number, depth: number) => {
    const children: Array<{ child: any; offset: number }> = [];
    node.content?.forEach?.((child: any, offset: number) => {
      children.push({ child, offset });
    });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({
        node: children[index].child,
        nodeStart: parentStart + 1 + children[index].offset,
        depth,
      });
    }
  };

  listNode.forEach((child: any, offset: number) => {
    stack.push({ node: child, nodeStart: listStart + 1 + offset, depth: 0 });
  });

  stack.reverse();

  while (stack.length > 0) {
    const { node, nodeStart, depth } = stack.pop()!;
    if (!consumeClipboardTraversalNode(budget, depth)) {
      return { selectedItems: [], startsAtSelectedItemBoundary: false };
    }
    if (!node) continue;

    if (node.type?.name === 'list_item') {
      const firstChild = node.firstChild;
      if (firstChild?.type?.name === 'paragraph') {
        const paragraphStart = nodeStart + 1;
        const paragraphEnd = paragraphStart + firstChild.nodeSize;
        if (paragraphEnd > state.selection.from && paragraphStart < state.selection.to) {
          if (nodeStart === state.selection.from) {
            startsAtSelectedItemBoundary = true;
          }
          const cloned = cloneListNodeForClipboard(node, budget, depth);
          if (!cloned) {
            return { selectedItems: [], startsAtSelectedItemBoundary: false };
          }
          selectedItems.push(cloned);
          continue;
        }
      }
    }

    pushChildren(node, nodeStart, depth + 1);
  }

  return { selectedItems, startsAtSelectedItemBoundary };
}

function cloneListNodeForClipboard(
  node: any,
  budget: ClipboardTraversalBudget = createClipboardTraversalBudget(),
  depth = 0
): any | null {
  if (!consumeClipboardTraversalNode(budget, depth)) {
    return null;
  }
  if (!node?.content?.size) {
    return node;
  }

  const children: any[] = [];
  for (const child of getProseNodeChildren(node)) {
    const cloned = cloneListNodeForClipboard(child, budget, depth + 1);
    if (!cloned) return null;
    children.push(cloned);
  }
  const attrs = (node.type?.name === 'list_item' || isListContainerNode(node))
    ? { ...node.attrs, spread: false }
    : node.attrs;

  return node.type.create(attrs, children, node.marks);
}

export function getSelectionSlice(state: EditorState): Slice {
  const selection = state.selection as SelectionWithContent;

  if (typeof selection.content === 'function') {
    return selection.content();
  }

  return state.doc.slice(selection.from, selection.to);
}

export function serializeSelectionToClipboardText(
  state: EditorState,
  markdownSerializer?: Serializer | null
): string {
  const selection = state.selection as SelectionWithContent;
  if (typeof selection.content !== 'function' && selection.from === selection.to) {
    return '';
  }

  const slice = getSelectionSlice(state);
  if (slice.content.size === 0) return '';

  const singleCellText = serializeSingleSelectedCellContent(state);
  if (singleCellText !== null) {
    return serializeLeadingFrontmatterMarkdown(singleCellText);
  }

  const singleCellTableSliceText = serializeSingleCellTableSlice(slice);
  if (singleCellTableSliceText !== null) {
    return serializeLeadingFrontmatterMarkdown(singleCellTableSliceText);
  }

  if (shouldCopyTextSelectionAsPlainText(state, slice)) {
    return serializeSliceAsVisiblePlainText(slice);
  }

  const singleListItemText = serializeSingleListItemWithoutMarker(slice);
  if (singleListItemText !== null) {
    return serializeLeadingFrontmatterMarkdown(singleListItemText);
  }

  if (markdownSerializer) {
    const selectedListText = serializeBoundarySelectedListItemsWithMarkdown(state, markdownSerializer);
    if (selectedListText !== null) {
      return serializeLeadingFrontmatterMarkdown(selectedListText);
    }

    const topLevelBlockText = serializeSliceTopLevelBlocks(state, slice, markdownSerializer);
    if (topLevelBlockText !== null) {
      return serializeLeadingFrontmatterMarkdown(topLevelBlockText);
    }

    try {
      const doc = state.schema.topNodeType.createAndFill(undefined, slice.content);
      if (doc) {
        return serializeLeadingFrontmatterMarkdown(
          normalizeSerializedMarkdownSelection(markdownSerializer(doc))
        );
      }
    } catch {
    }
  }

  return serializeLeadingFrontmatterMarkdown(
    normalizeSerializedMarkdownSelection(serializeSliceToText(slice))
  );
}
