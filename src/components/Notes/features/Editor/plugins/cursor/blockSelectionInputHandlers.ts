import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  setClipboardText,
  writeTextToClipboard,
} from './blockSelectionCommands';
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

function isClipboardShortcut(event: KeyboardEvent, key: 'c' | 'x'): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === key
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

  if (isClipboardShortcut(event, 'c')) {
    const text = serializeSelectedBlocks(view.state, selectedBlocks);
    if (text.length === 0) return false;

    event.preventDefault();
    void writeTextToClipboard(text);
    return true;
  }

  if (isClipboardShortcut(event, 'x')) {
    const text = serializeSelectedBlocks(view.state, selectedBlocks);
    if (text.length === 0) return false;

    event.preventDefault();
    void writeTextToClipboard(text).then((didCopy) => {
      if (didCopy) {
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
  setClipboardText(event, text);
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
  setClipboardText(event, text);
  return deleteSelectedBlocks(view, selectedBlocks);
}
