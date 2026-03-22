import type { EditorState } from '@milkdown/kit/prose/state';
import type { Slice } from '@milkdown/kit/prose/model';
import type { Serializer } from '@milkdown/kit/transformer';

import { normalizeSerializedMarkdownSelection } from './markdownSerializationUtils';
import { serializeSliceToText } from './serializer';

type SelectionWithContent = EditorState['selection'] & {
  content?: () => Slice;
};

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

  if (markdownSerializer) {
    try {
      const doc = state.schema.topNodeType.createAndFill(undefined, slice.content);
      if (doc) {
        return normalizeSerializedMarkdownSelection(markdownSerializer(doc));
      }
    } catch {
    }
  }

  return normalizeSerializedMarkdownSelection(serializeSliceToText(slice));
}
