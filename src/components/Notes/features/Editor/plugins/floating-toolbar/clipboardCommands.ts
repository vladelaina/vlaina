import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';

interface CopySelectionOptions {
  collapseAfterCopy?: boolean;
}

function isSameProseObject<T extends { eq?: (other: T) => boolean }>(current: T, previous: T): boolean {
  if (current === previous) {
    return true;
  }
  return typeof current.eq === 'function' && current.eq(previous);
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
    isSameProseObject(view.state.doc, doc) &&
    isSameProseObject(selection, view.state.selection)
  ) {
    collapseSelectionAndHideFloatingToolbar(view);
  }
  return true;
}
