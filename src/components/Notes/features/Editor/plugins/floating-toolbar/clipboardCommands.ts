import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';

interface CopySelectionOptions {
  collapseAfterCopy?: boolean;
}

function isSameEditorValue<T>(current: T, previous: T): boolean {
  const maybeComparable = current as { eq?: (other: T) => boolean };
  if (typeof maybeComparable.eq === 'function') {
    return maybeComparable.eq(previous);
  }
  return current === previous;
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
    isSameEditorValue(view.state.doc, doc) &&
    isSameEditorValue(selection, view.state.selection)
  ) {
    collapseSelectionAndHideFloatingToolbar(view);
  }
  return true;
}
