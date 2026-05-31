import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { clearBlockSelection, getBlockSelectionPluginState } from '../cursor/blockSelectionPluginState';
import { serializeSelectedBlocksToText } from '../cursor/blockSelectionSerializer';
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
  const markdownSerializer = getCurrentMarkdownSerializer();
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  const text = selectedBlocks.length > 0
    ? serializeSelectedBlocksToText(view.state, selectedBlocks, { markdownSerializer })
    : serializeSelectionToClipboardText(view.state, markdownSerializer);
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
    selectedBlocks.length > 0 &&
    options.collapseAfterCopy !== false &&
    isSameProseObject(view.state.doc, doc)
  ) {
    clearBlockSelection(view);
    return true;
  }

  if (
    selectedBlocks.length === 0 &&
    options.collapseAfterCopy !== false &&
    isSameProseObject(view.state.doc, doc) &&
    isSameProseObject(selection, view.state.selection)
  ) {
    collapseSelectionAndHideFloatingToolbar(view);
  }
  return true;
}
