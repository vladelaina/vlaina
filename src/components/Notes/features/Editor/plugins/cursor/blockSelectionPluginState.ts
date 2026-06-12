import { PluginKey, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { DecorationSet } from '@milkdown/kit/prose/view';
import {
  LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD,
  type BlockRange,
} from './blockSelectionUtils';

const BLOCK_SELECTION_ACTIVE_CLASS = 'editor-block-selection-active';
const BLOCK_SELECTION_LARGE_CLASS = 'editor-block-selection-large';

export interface BlankAreaDragBoxState {
  selectedBlocks: BlockRange[];
  decorations: DecorationSet;
  editableMarkdownBlankLineDecorations: DecorationSet;
  interactionDecorations: DecorationSet;
}

export type BlockSelectionAction =
  | { type: 'set-blocks'; blocks: BlockRange[] }
  | { type: 'clear-blocks' };

export const blankAreaDragBoxPluginKey = new PluginKey<BlankAreaDragBoxState>('blankAreaDragBox');

export const EMPTY_BLOCK_SELECTION_PLUGIN_STATE: BlankAreaDragBoxState = {
  selectedBlocks: [],
  decorations: DecorationSet.empty,
  editableMarkdownBlankLineDecorations: DecorationSet.empty,
  interactionDecorations: DecorationSet.empty,
};

export const CLEAR_BLOCKS_ACTION: BlockSelectionAction = { type: 'clear-blocks' };

export function getBlockSelectionPluginState(state: EditorState): BlankAreaDragBoxState {
  return blankAreaDragBoxPluginKey.getState(state) ?? EMPTY_BLOCK_SELECTION_PLUGIN_STATE;
}

export function hasSelectedBlocks(state: EditorState): boolean {
  return getBlockSelectionPluginState(state).selectedBlocks.length > 0;
}

export function dispatchBlockSelectionAction(view: EditorView, action: BlockSelectionAction): void {
  view.dispatch(view.state.tr.setMeta(blankAreaDragBoxPluginKey, action));
}

export function clearBlockSelection(view: EditorView): void {
  if (!hasSelectedBlocks(view.state)) return;
  dispatchBlockSelectionAction(view, CLEAR_BLOCKS_ACTION);
}

export function isLargeBlockSelection(selectedBlocks: readonly BlockRange[]): boolean {
  return selectedBlocks.length >= LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD;
}

export function setBlockSelectionVisualState(view: EditorView, active: boolean, large = false): void {
  view.dom.classList.toggle(BLOCK_SELECTION_ACTIVE_CLASS, active);
  view.dom.classList.toggle(BLOCK_SELECTION_LARGE_CLASS, active && large);
}

export function syncBlockSelectionVisualState(view: EditorView): void {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  setBlockSelectionVisualState(view, selectedBlocks.length > 0, isLargeBlockSelection(selectedBlocks));
}
