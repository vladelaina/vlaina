import { PluginKey, type EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { DecorationSet } from '@milkdown/kit/prose/view';
import { themeStyleResetTokens } from '@/styles/themeTokens';
import {
  isLargeBlockSelectionDocument,
  shouldUseLargeBlockSelectionRendering,
  type BlockRange,
} from './blockSelectionTypes';

const BLOCK_SELECTION_ACTIVE_CLASS = 'editor-block-selection-active';
const BLOCK_SELECTION_ENABLED_CLASS = 'editor-block-selection-enabled';
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

export function isLargeBlockSelection(
  selectedBlocks: readonly BlockRange[],
  doc: { childCount: number },
): boolean {
  return shouldUseLargeBlockSelectionRendering(doc, selectedBlocks.length);
}

export function setBlockSelectionVisualState(
  view: EditorView,
  active: boolean,
  large = isLargeBlockSelectionDocument(view.state.doc),
): void {
  view.dom.classList.toggle(BLOCK_SELECTION_ACTIVE_CLASS, active && !large);
  view.dom.classList.toggle(BLOCK_SELECTION_LARGE_CLASS, large);
  view.dom.style.caretColor = active && large
    ? themeStyleResetTokens.colorTransparent
    : '';
}

export function setBlockSelectionEnabled(view: EditorView, enabled: boolean): void {
  view.dom.classList.toggle(BLOCK_SELECTION_ENABLED_CLASS, enabled);
}

export function syncBlockSelectionVisualState(view: EditorView): void {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  setBlockSelectionVisualState(
    view,
    selectedBlocks.length > 0,
    isLargeBlockSelectionDocument(view.state.doc)
      || isLargeBlockSelection(selectedBlocks, view.state.doc),
  );
}
