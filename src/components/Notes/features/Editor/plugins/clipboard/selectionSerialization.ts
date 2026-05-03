import type { EditorState } from '@milkdown/kit/prose/state';
import { Fragment, type Slice } from '@milkdown/kit/prose/model';
import type { Serializer } from '@milkdown/kit/transformer';

import {
  joinSerializedBlocks,
  normalizeSerializedMarkdownBlock,
  normalizeSerializedMarkdownSelection,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeSliceToText } from './serializer';
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

function resolveListItemNode(node: any): any | null {
  if (!node) {
    return null;
  }

  if (node.type?.name === 'list_item') {
    return node;
  }

  if (!isListContainerNode(node)) {
    return null;
  }

  const listItems = getNodeChildren(node);
  if (listItems.length !== 1) {
    return null;
  }

  return listItems[0]?.type?.name === 'list_item' ? listItems[0] : null;
}

function getEdgeChild(node: any, edge: 'first' | 'last'): any | null {
  const children = getNodeChildren(node);
  if (children.length === 0) {
    return null;
  }

  return edge === 'first' ? children[0] : children[children.length - 1];
}

function descendOpenEdgeNode(slice: Slice, depth: number, edge: 'first' | 'last'): any | null {
  let current: any = { content: slice.content };

  for (let level = 0; level < depth; level += 1) {
    current = getEdgeChild(current, edge);
    if (!current) {
      return null;
    }
  }

  return current;
}

function resolveDeepestListItemAlongEdge(
  slice: Slice,
  depth: number,
  edge: 'first' | 'last'
): any | null {
  let current: any = { content: slice.content };
  let deepestListItem: any | null = null;

  for (let level = 0; level < depth; level += 1) {
    current = getEdgeChild(current, edge);
    if (!current) {
      break;
    }

    if (current.type?.name === 'list_item') {
      deepestListItem = current;
    }
  }

  return deepestListItem;
}

function resolveSingleListItemNode(slice: Slice): any | null {
  const startNode = resolveDeepestListItemAlongEdge(slice, slice.openStart, 'first');
  const endNode = resolveDeepestListItemAlongEdge(slice, slice.openEnd, 'last');
  if (startNode && startNode === endNode) {
    return startNode;
  }

  const topLevelNodes = getNodeChildren({ content: slice.content });
  if (topLevelNodes.length !== 1) {
    const edgeStartNode = resolveListItemNode(descendOpenEdgeNode(slice, slice.openStart, 'first'));
    const edgeEndNode = resolveListItemNode(descendOpenEdgeNode(slice, slice.openEnd, 'last'));
    return edgeStartNode && edgeStartNode === edgeEndNode ? edgeStartNode : null;
  }

  const topLevelNode = topLevelNodes[0];
  if (!topLevelNode) {
    return null;
  }

  const directListItem = resolveListItemNode(topLevelNode);
  if (directListItem) {
    return directListItem;
  }

  const edgeStartNode = resolveListItemNode(descendOpenEdgeNode(slice, slice.openStart, 'first'));
  const edgeEndNode = resolveListItemNode(descendOpenEdgeNode(slice, slice.openEnd, 'last'));
  return edgeStartNode && edgeStartNode === edgeEndNode ? edgeStartNode : null;
}

function serializeSingleListItemWithoutMarker(slice: Slice): string | null {
  const listItem = resolveSingleListItemNode(slice);
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

  const singleListItemText = serializeSingleListItemWithoutMarker(slice);
  if (singleListItemText !== null) {
    return serializeLeadingFrontmatterMarkdown(singleListItemText);
  }

  if (markdownSerializer) {
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
