import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  writeTextToClipboard,
} from './blockSelectionCommands';
import { clearBlockSelection, getBlockSelectionPluginState } from './blockSelectionPluginState';
import type { BlockRange } from './blockSelectionUtils';

type SerializeSelectedBlocks = (
  state: EditorState,
  selectedBlocks: readonly BlockRange[]
) => string;

type DeleteSelectedBlocks = (
  view: EditorView,
  selectedBlocks: readonly BlockRange[]
) => boolean;

interface BlockSelectionInputHandlerOptions {
  view: EditorView;
  selectedBlocks: readonly BlockRange[];
  serializeSelectedBlocks: SerializeSelectedBlocks;
  deleteSelectedBlocks: DeleteSelectedBlocks;
}

function areSameBlockRanges(a: readonly BlockRange[], b: readonly BlockRange[]): boolean {
  return a.length === b.length && a.every((range, index) => (
    range.from === b[index]?.from && range.to === b[index]?.to
  ));
}

function clearCapturedBlockSelection(view: EditorView, selectedBlocks: readonly BlockRange[], doc: EditorState['doc']): void {
  if (!view.state.doc.eq(doc)) return;
  if (!areSameBlockRanges(getBlockSelectionPluginState(view.state).selectedBlocks, selectedBlocks)) return;
  clearBlockSelection(view);
}

function isClipboardCopyShortcut(event: KeyboardEvent): boolean {
  if (event.altKey) return false;

  const key = event.key.toLowerCase();
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    (key === 'c' || key === 'insert')
  );
}

function isClipboardCutShortcut(event: KeyboardEvent): boolean {
  if (event.altKey) return false;

  const key = event.key.toLowerCase();
  return (
    ((event.metaKey || event.ctrlKey) && !event.shiftKey && key === 'x') ||
    (!(event.metaKey || event.ctrlKey) && event.shiftKey && key === 'delete')
  );
}

export function isClipboardEvent(event: Event): event is ClipboardEvent {
  return 'clipboardData' in event;
}

export function handleBlockSelectionKeyDown(
  event: KeyboardEvent,
  {
    view,
    selectedBlocks,
    serializeSelectedBlocks,
    deleteSelectedBlocks,
  }: BlockSelectionInputHandlerOptions,
): boolean {
  if (selectedBlocks.length === 0) return false;

  if (isClipboardCopyShortcut(event)) {
    const text = serializeSelectedBlocks(view.state, selectedBlocks);
    if (text.length === 0) return false;

    const doc = view.state.doc;
    event.preventDefault();
    void writeTextToClipboard(text).then((didCopy) => {
      if (didCopy) {
        clearCapturedBlockSelection(view, selectedBlocks, doc);
      }
    });
    return true;
  }

  if (isClipboardCutShortcut(event)) {
    const text = serializeSelectedBlocks(view.state, selectedBlocks);
    if (text.length === 0) return false;

    const doc = view.state.doc;
    event.preventDefault();
    void writeTextToClipboard(text).then((didCopy) => {
      if (didCopy && view.state.doc.eq(doc)) {
        deleteSelectedBlocks(view, selectedBlocks);
      }
    });
    return true;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
    event.preventDefault();
    return deleteSelectedBlocks(view, selectedBlocks);
  }

  return false;
}

export function handleBlockSelectionCopy(
  event: ClipboardEvent,
  {
    view,
    selectedBlocks,
    serializeSelectedBlocks,
  }: Omit<BlockSelectionInputHandlerOptions, 'deleteSelectedBlocks'>,
): boolean {
  if (selectedBlocks.length === 0) return false;

  const text = serializeSelectedBlocks(view.state, selectedBlocks);
  const doc = view.state.doc;
  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', text);
    clearBlockSelection(view);
    return true;
  }

  void writeTextToClipboard(text).then((didCopy) => {
    if (didCopy) {
      clearCapturedBlockSelection(view, selectedBlocks, doc);
    }
  });
  return true;
}

export function handleBlockSelectionCut(
  event: ClipboardEvent,
  {
    view,
    selectedBlocks,
    serializeSelectedBlocks,
    deleteSelectedBlocks,
  }: BlockSelectionInputHandlerOptions,
): boolean {
  if (selectedBlocks.length === 0) return false;

  const text = serializeSelectedBlocks(view.state, selectedBlocks);
  const doc = view.state.doc;
  event.preventDefault();
  if (event.clipboardData) {
    event.clipboardData.setData('text/plain', text);
    return deleteSelectedBlocks(view, selectedBlocks);
  }

  void writeTextToClipboard(text).then((didCopy) => {
    if (didCopy && view.state.doc.eq(doc)) {
      deleteSelectedBlocks(view, selectedBlocks);
    }
  });
  return true;
}
