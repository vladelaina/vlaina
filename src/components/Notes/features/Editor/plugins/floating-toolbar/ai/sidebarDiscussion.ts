import type { EditorView } from '@milkdown/kit/prose/view';
import { createAIChatSession } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useToastStore } from '@/stores/useToastStore';
import { useUIStore } from '@/stores/uiSlice';
import { normalizeSelectedTextForComposer } from '@/lib/ui/normalizeSelectedTextForComposer';
import { serializeSelectedBlocksToText } from '../../cursor/blockSelectionCommands';
import { getBlockSelectionPluginState, hasSelectedBlocks } from '../../cursor/blockSelectionPluginState';
import { floatingToolbarKey } from '../floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../types';
import { getSerializedSelectionText } from './selectionCommands';
import { getCurrentMarkdownSerializer } from '../../../utils/editorViewRegistry';

export function canOpenSidebarDiscussionForSelection(view: EditorView): boolean {
  return !view.state.selection.empty || hasSelectedBlocks(view.state);
}

function getSerializedSidebarDiscussionText(view: EditorView): string {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  if (selectedBlocks.length > 0) {
    return serializeSelectedBlocksToText(view.state, selectedBlocks, {
      markdownSerializer: getCurrentMarkdownSerializer(),
    });
  }

  return getSerializedSelectionText(view);
}

export function openSidebarDiscussionForSelection(view: EditorView): boolean {
  const selectedText = normalizeSelectedTextForComposer(getSerializedSidebarDiscussionText(view));
  if (selectedText.length === 0) {
    useToastStore.getState().addToast('The current selection cannot be quoted to the AI chat.', 'warning');
    return false;
  }

  const ui = useUIStore.getState();
  const currentSessionId = useAIUIStore.getState().currentSessionId;

  if (ui.notesChatPanelCollapsed || !currentSessionId) {
    createAIChatSession('');
  }

  ui.queueNotesChatComposerInsert(selectedText);
  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.HIDE,
    })
  );
  return true;
}
