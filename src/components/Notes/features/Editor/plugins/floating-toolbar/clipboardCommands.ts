import type { EditorView } from '@milkdown/kit/prose/view';
import { collapseSelectionAndHideFloatingToolbar } from '../clipboard/copyCleanup';
import { serializeSelectionToClipboardText } from '../clipboard/selectionSerialization';
import { writeTextToClipboard } from '../cursor/blockSelectionCommands';
import { clearBlockSelection, getBlockSelectionPluginState } from '../cursor/blockSelectionPluginState';
import { serializeSelectedBlocksToText } from '../cursor/blockSelectionSerializer';
import { getCurrentMarkdownSerializer } from '../../utils/editorViewRegistry';
import { getBoundedTextBetween } from '../shared/selectionTextLimits';

interface CopySelectionOptions {
  collapseAfterCopy?: boolean;
}

function isSameProseObject<T extends { eq?: (other: T) => boolean }>(current: T, previous: T): boolean {
  if (current === previous) {
    return true;
  }
  return typeof current.eq === 'function' && current.eq(previous);
}

function isSelectionEmpty(selection: EditorView['state']['selection']): boolean {
  return selection.empty || selection.from === selection.to;
}

function serializeTextSelectionForClipboard(
  state: EditorView['state'],
  markdownSerializer: ReturnType<typeof getCurrentMarkdownSerializer>,
): string {
  const serializedText = serializeSelectionToClipboardText(state, markdownSerializer);
  if (serializedText.length > 0 || isSelectionEmpty(state.selection)) {
    return serializedText;
  }

  if (typeof state.doc.textBetween !== 'function') {
    return '';
  }
  return getBoundedTextBetween(state.doc, state.selection.from, state.selection.to, '\n');
}

export async function copySelectionToClipboard(
  view: EditorView,
  options: CopySelectionOptions = {}
): Promise<boolean> {
  const markdownSerializer = getCurrentMarkdownSerializer();
  const selectedBlocks = getBlockSelectionPluginState(view.state).selectedBlocks;
  const shouldCopySelectedBlocks = selectedBlocks.length > 0;
  const text = shouldCopySelectedBlocks
    ? serializeSelectedBlocksToText(view.state, selectedBlocks, {
        compactPlainParagraphs: true,
        markdownSerializer,
      })
    : serializeTextSelectionForClipboard(view.state, markdownSerializer);
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
    shouldCopySelectedBlocks &&
    options.collapseAfterCopy !== false &&
    isSameProseObject(view.state.doc, doc)
  ) {
    clearBlockSelection(view);
    return true;
  }

  if (
    !shouldCopySelectedBlocks &&
    options.collapseAfterCopy !== false &&
    isSameProseObject(view.state.doc, doc) &&
    isSameProseObject(selection, view.state.selection)
  ) {
    collapseSelectionAndHideFloatingToolbar(view);
  }
  return true;
}
