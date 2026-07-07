import type { EditorState } from '@milkdown/kit/prose/state';
import type { Slice } from '@milkdown/kit/prose/model';
import type { Serializer } from '@milkdown/kit/transformer';
import {
  normalizeSerializedMarkdownSelection,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeSliceToText } from './serializer';
import {
  consumeClipboardTraversalNode,
  createClipboardTraversalBudget,
  getProseNodeChildren,
  type ClipboardTraversalBudget,
} from './clipboardTraversalBudget';

function isListContainerNode(node: any): boolean {
  return node?.type?.name === 'bullet_list' || node?.type?.name === 'ordered_list';
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

export function serializeSingleListItemWithoutMarker(slice: Slice): string | null {
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

export function serializeBoundarySelectedListItemsWithMarkdown(
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
