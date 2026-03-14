import type { EditorView } from '@milkdown/kit/prose/view';
import { normalizeSerializedMarkdownSelection } from '../clipboard/markdownSerializationUtils';
import { serializeSliceToText } from '../clipboard/serializer';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';

export async function copySelectionToClipboard(view: EditorView): Promise<boolean> {
  const { from, to } = view.state.selection;
  if (from === to) {
    return false;
  }

  const text = normalizeSerializedMarkdownSelection(
    serializeSliceToText(view.state.doc.slice(from, to))
  );

  await writeTextToClipboard(text);
  view.focus();
  return true;
}
