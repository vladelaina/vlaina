import type { Transaction } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { blankAreaDragBoxPluginKey } from '../cursor';
import { deleteSelectedBlocks } from '../cursor/blockSelectionCommands';
import { normalizeBlockRanges, type BlockRange } from '../cursor/blockSelectionUtils';

interface BlockSelectionPluginState {
  selectedBlocks: BlockRange[];
}

function getSelectedBlocks(view: EditorView): BlockRange[] {
  const pluginState = blankAreaDragBoxPluginKey.getState(view.state) as BlockSelectionPluginState | undefined;
  if (!pluginState || !Array.isArray(pluginState.selectedBlocks)) return [];
  return normalizeBlockRanges(pluginState.selectedBlocks);
}

export function getFrontmatterSelectedBlocks(
  view: EditorView,
  nodePos: number | undefined,
  nodeSize: number,
): BlockRange[] {
  if (nodePos === undefined) return [];

  const selectedBlocks = getSelectedBlocks(view);
  if (selectedBlocks.length === 0) return [];

  const isCurrentFrontmatterSelected = selectedBlocks.some(
    (range) => range.from === nodePos && range.to === nodePos + nodeSize,
  );

  return isCurrentFrontmatterSelected ? selectedBlocks : [];
}

export function deleteSelectedFrontmatterBlocks(
  view: EditorView,
  nodePos: number | undefined,
  nodeSize: number,
): boolean {
  const selectedBlocks = getFrontmatterSelectedBlocks(view, nodePos, nodeSize);
  if (selectedBlocks.length === 0) return false;

  return deleteSelectedBlocks(
    view,
    selectedBlocks,
    (tr: Transaction) => tr.setMeta(blankAreaDragBoxPluginKey, { type: 'clear-blocks' }),
  );
}
