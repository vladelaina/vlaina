import type { EditorState } from '@milkdown/kit/prose/state';
import type { Slice } from '@milkdown/kit/prose/model';
import type { Serializer } from '@milkdown/kit/transformer';

import { normalizeSerializedMarkdownSelection } from './markdownSerializationUtils';
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

function serializeSingleListItemWithoutMarker(slice: Slice): string | null {
  const topLevelNodes = getNodeChildren({ content: slice.content });
  if (topLevelNodes.length !== 1) {
    return null;
  }

  const listNode = topLevelNodes[0];
  if (
    !listNode ||
    (listNode.type?.name !== 'bullet_list' && listNode.type?.name !== 'ordered_list')
  ) {
    return null;
  }

  const listItems = getNodeChildren(listNode);
  if (listItems.length !== 1) {
    return null;
  }

  const listItem = listItems[0];
  if (listItem?.type?.name !== 'list_item') {
    return null;
  }

  const itemChildren = getNodeChildren(listItem);
  if (itemChildren.length !== 1 || itemChildren[0]?.type?.name !== 'paragraph') {
    return null;
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
