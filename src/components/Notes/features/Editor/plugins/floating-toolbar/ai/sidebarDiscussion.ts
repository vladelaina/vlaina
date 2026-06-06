import type { EditorView } from '@milkdown/kit/prose/view';
import { translate } from '@/lib/i18n';
import { createAIChatSession } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useToastStore } from '@/stores/useToastStore';
import { useUIStore } from '@/stores/uiSlice';
import { normalizeSelectedTextForComposer } from '@/lib/ui/normalizeSelectedTextForComposer';
import {
  MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS,
  canInsertTextIntoComposerValue,
} from '@/lib/ui/composerFocusRegistry';
import { serializeSelectedBlocksToText } from '../../cursor/blockSelectionCommands';
import { getBlockSelectionPluginState, hasSelectedBlocks } from '../../cursor/blockSelectionPluginState';
import { floatingToolbarKey } from '../floatingToolbarKey';
import { TOOLBAR_ACTIONS } from '../types';
import { getSerializedSelectionText } from './selectionCommands';
import { getCurrentMarkdownSerializer } from '../../../utils/editorViewRegistry';

export function canOpenSidebarDiscussionForSelection(view: EditorView): boolean {
  return !view.state.selection.empty || hasSelectedBlocks(view.state);
}

function isRangeTooLarge(from: number, to: number): boolean {
  return to - from > MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS;
}

function isSidebarDiscussionSelectionTooLarge(view: EditorView): boolean {
  const { selectedBlocks } = getBlockSelectionPluginState(view.state);
  if (selectedBlocks.length > 0) {
    return selectedBlocks.some((range) => isRangeTooLarge(range.from, range.to));
  }

  const { from, to } = view.state.selection;
  return isRangeTooLarge(from, to);
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
  if (isSidebarDiscussionSelectionTooLarge(view)) {
    useToastStore.getState().addToast(translate('editor.ai.cannotQuoteSelection'), 'warning');
    return false;
  }

  const selectedText = normalizeSelectedTextForComposer(getSerializedSidebarDiscussionText(view));
  if (selectedText.length === 0 || !canInsertTextIntoComposerValue('', selectedText)) {
    useToastStore.getState().addToast(translate('editor.ai.cannotQuoteSelection'), 'warning');
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
