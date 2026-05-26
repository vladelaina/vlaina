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

type SelectionWithContent = EditorState['selection'] & {
  content?: () => Slice;
};

function getNodeChildren(node: any): any[] {
  const children: any[] = [];
  node?.content?.forEach?.((child: any) => {
    children.push(child);
  });
  return children;
}

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
  const visit = (node: any): boolean => {
    if (node.isTextblock && node.content.size === 0) {
      return true;
    }

    return getNodeChildren(node).some(visit);
  };

  return getNodeChildren({ content: slice.content }).some(visit);
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
  const topLevelNodes = getNodeChildren({ content: slice.content });
  if (topLevelNodes.length !== 1) return null;

  const table = topLevelNodes[0];
  if (table?.type?.name !== 'table') return null;

  const rows = getNodeChildren(table);
  if (rows.length !== 1) return null;

  const cells = getNodeChildren(rows[0]);
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

  const children = getNodeChildren(node);
  return children.length === 1 && children[0]?.type?.name === 'paragraph';
}

function resolveSingleParagraphListItemDescendant(node: any): any | null {
  let resolved: any | null = null;
  let hasMultipleListItemContent = false;

  const visit = (current: any): boolean => {
    if (!current) {
      return true;
    }

    if (isParagraphOnlyListItem(current)) {
      if (resolved) {
        resolved = null;
        return false;
      }
      resolved = current;
      return true;
    }

    const children = getNodeChildren(current);
    if (
      current.type?.name === 'list_item' &&
      children.some((child) => child.type?.name === 'paragraph' && child.content?.size > 0)
    ) {
      hasMultipleListItemContent = true;
      return false;
    }

    for (const child of children) {
      if (!visit(child)) {
        return false;
      }
    }

    return true;
  };

  visit(node);
  return hasMultipleListItemContent ? null : resolved;
}

function serializeSingleListItemWithoutMarker(slice: Slice): string | null {
  const listItem = resolveSingleParagraphListItemDescendant({ content: slice.content });
  if (!listItem) {
    return null;
  }

  const itemChildren = getNodeChildren(listItem);
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
  const topLevelNodes = getNodeChildren({ content: slice.content });
  if (topLevelNodes.length === 0) {
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

  const visit = (node: any, nodeStart: number): void => {
    if (!node) {
      return;
    }

    if (node.type?.name === 'list_item') {
      const firstChild = node.firstChild;
      if (firstChild?.type?.name === 'paragraph') {
        const paragraphStart = nodeStart + 1;
        const paragraphEnd = paragraphStart + firstChild.nodeSize;
        if (paragraphEnd > state.selection.from && paragraphStart < state.selection.to) {
          if (nodeStart === state.selection.from) {
            startsAtSelectedItemBoundary = true;
          }
          selectedItems.push(cloneListNodeForClipboard(node));
          return;
        }
      }
    }

    node.content?.forEach?.((child: any, offset: number) => {
      visit(child, nodeStart + 1 + offset);
    });
  };

  listNode.forEach((child: any, offset: number) => {
    visit(child, listStart + 1 + offset);
  });

  return { selectedItems, startsAtSelectedItemBoundary };
}

function cloneListNodeForClipboard(node: any): any {
  if (!node?.content?.size) {
    return node;
  }

  const children = getNodeChildren(node).map(cloneListNodeForClipboard);
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
