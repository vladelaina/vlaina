import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';

interface CopySelectionOptions {
  collapseAfterCopy?: boolean;
}

export async function copySelectionToClipboard(
  view: EditorView,
  options: CopySelectionOptions = {}
): Promise<boolean> {
  const text = serializeSelectionToClipboardText(view.state, getCurrentMarkdownSerializer());
  if (text.length === 0) {
    return false;
  }

  const selection = view.state.selection;
  const doc = view.state.doc;
  const didCopy = await writeTextToClipboard(text);
  if (!didCopy) {
    return false;
  }

  if (
    options.collapseAfterCopy !== false &&
    view.state.doc.eq(doc) &&
    selection.eq(view.state.selection)
  ) {
    collapseSelectionAndHideFloatingToolbar(view);
  }
  return true;
}
