import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';

export async function copySelectionToClipboard(view: EditorView): Promise<boolean> {
  const text = serializeSelectionToClipboardText(view.state);
  if (text.length === 0) {
    return false;
  }

  const didCopy = await writeTextToClipboard(text);
  if (!didCopy) {
    return false;
  }

  collapseSelectionAndHideFloatingToolbar(view);
  return true;
}
