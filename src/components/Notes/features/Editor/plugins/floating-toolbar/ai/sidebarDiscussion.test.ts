import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUIStore } from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS } from '@/lib/ui/composerFocusRegistry';
import { TOOLBAR_ACTIONS } from '../types';
import { openSidebarDiscussionForSelection } from './sidebarDiscussion';

vi.mock('./selectionCommands', () => ({
  getSerializedSelectionText: vi.fn(),
}));

vi.mock('../../cursor/blockSelectionCommands', () => ({
  serializeSelectedBlocksToText: vi.fn(),
}));

vi.mock('../../cursor/blockSelectionPluginState', () => ({
  getBlockSelectionPluginState: vi.fn(() => ({ selectedBlocks: [] })),
  hasSelectedBlocks: vi.fn(() => false),
}));

vi.mock('../../../utils/editorViewRegistry', () => ({
  getCurrentMarkdownSerializer: vi.fn(() => null),
}));

vi.mock('@/stores/useAIStore', () => ({
  createAIChatSession: vi.fn(),
}));

import { createAIChatSession } from '@/stores/useAIStore';
import { serializeSelectedBlocksToText } from '../../cursor/blockSelectionCommands';
import { getBlockSelectionPluginState, hasSelectedBlocks } from '../../cursor/blockSelectionPluginState';
import { getCurrentMarkdownSerializer } from '../../../utils/editorViewRegistry';
import { getSerializedSelectionText } from './selectionCommands';
import { canOpenSidebarDiscussionForSelection } from './sidebarDiscussion';

function createView(): EditorView {
  return {
    state: {
      selection: {
        from: 1,
        to: 8,
        empty: false,
      },
      tr: {
        setMeta: vi.fn((_key, meta) => meta),
      },
    },
    dispatch: vi.fn(),
  } as unknown as EditorView;
}

describe('openSidebarDiscussionForSelection', () => {
  beforeEach(() => {
    localStorage.clear();
    useToastStore.setState({ toasts: [] });
    useUIStore.setState({
      notesChatPanelCollapsed: false,
      notesChatFloatingOpen: false,
      pendingNotesChatComposerInsert: null,
    });
    useAIUIStore.setState({
      currentSessionId: 'session-1',
      temporaryChatEnabled: false,
      selectionInitialized: true,
    });
    vi.mocked(createAIChatSession).mockReset();
    vi.mocked(getSerializedSelectionText).mockReset();
    vi.mocked(serializeSelectedBlocksToText).mockReset();
    vi.mocked(getBlockSelectionPluginState).mockReset();
    vi.mocked(getBlockSelectionPluginState).mockReturnValue({ selectedBlocks: [] } as never);
    vi.mocked(hasSelectedBlocks).mockReset();
    vi.mocked(hasSelectedBlocks).mockReturnValue(false);
    vi.mocked(getCurrentMarkdownSerializer).mockReset();
    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(null);
  });

  it('queues the normalized selection into the floating chat and hides the toolbar', () => {
    vi.mocked(getSerializedSelectionText).mockReturnValue('Selected line 1\n\n\nSelected line 2');
    const view = createView();

    const opened = openSidebarDiscussionForSelection(view);

    expect(opened).toBe(true);
    expect(useUIStore.getState().notesChatPanelCollapsed).toBe(true);
    expect(useUIStore.getState().notesChatFloatingOpen).toBe(true);
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('Selected line 1\n\nSelected line 2');
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TOOLBAR_ACTIONS.HIDE,
      })
    );
  });

  it('opens the floating chat without creating a session when the current session is active', () => {
    useUIStore.setState({
      notesChatPanelCollapsed: true,
      notesChatFloatingOpen: false,
      pendingNotesChatComposerInsert: null,
    });
    vi.mocked(getSerializedSelectionText).mockReturnValue('Selected line 1');

    openSidebarDiscussionForSelection(createView());

    expect(createAIChatSession).not.toHaveBeenCalled();
    expect(useUIStore.getState().notesChatPanelCollapsed).toBe(true);
    expect(useUIStore.getState().notesChatFloatingOpen).toBe(true);
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('Selected line 1');
  });

  it('creates a new session before queuing when the UI selection has no active session', () => {
    useAIUIStore.setState({
      currentSessionId: null,
      temporaryChatEnabled: false,
      selectionInitialized: true,
    });
    vi.mocked(getSerializedSelectionText).mockReturnValue('Selected line 1');

    openSidebarDiscussionForSelection(createView());

    expect(createAIChatSession).toHaveBeenCalledWith('');
    expect(useUIStore.getState().notesChatPanelCollapsed).toBe(true);
    expect(useUIStore.getState().notesChatFloatingOpen).toBe(true);
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('Selected line 1');
  });

  it('queues serialized block selections into the floating chat', () => {
    const selectedBlocks = [{ from: 2, to: 8 }];
    const markdownSerializer = vi.fn();
    vi.mocked(getBlockSelectionPluginState).mockReturnValue({ selectedBlocks } as never);
    vi.mocked(getCurrentMarkdownSerializer).mockReturnValue(markdownSerializer as never);
    vi.mocked(serializeSelectedBlocksToText).mockReturnValue('## Selected block');

    openSidebarDiscussionForSelection(createView());

    expect(serializeSelectedBlocksToText).toHaveBeenCalledWith(
      expect.anything(),
      selectedBlocks,
      { markdownSerializer },
    );
    expect(getSerializedSelectionText).not.toHaveBeenCalled();
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('## Selected block');
  });

  it('allows sidebar discussion when only block selection is active', () => {
    vi.mocked(hasSelectedBlocks).mockReturnValue(true);
    const view = {
      state: {
        selection: {
          empty: true,
        },
      },
    } as unknown as EditorView;

    expect(canOpenSidebarDiscussionForSelection(view)).toBe(true);
  });

  it('shows a warning and does not queue a draft for an empty selection', () => {
    vi.mocked(getSerializedSelectionText).mockReturnValue('   ');
    const view = createView();

    const opened = openSidebarDiscussionForSelection(view);

    expect(opened).toBe(false);
    expect(useUIStore.getState().pendingNotesChatComposerInsert).toBeNull();
    expect(useToastStore.getState().toasts[useToastStore.getState().toasts.length - 1]?.message).toBe(
      'The current selection cannot be quoted to the AI chat.'
    );
    expect(view.dispatch).not.toHaveBeenCalled();
  });

  it('does not serialize text selections that are too large to quote to chat', () => {
    const view = {
      ...createView(),
      state: {
        ...createView().state,
        selection: {
          from: 1,
          to: MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS + 2,
          empty: false,
        },
      },
    } as unknown as EditorView;

    const opened = openSidebarDiscussionForSelection(view);

    expect(opened).toBe(false);
    expect(getSerializedSelectionText).not.toHaveBeenCalled();
    expect(useUIStore.getState().pendingNotesChatComposerInsert).toBeNull();
    expect(useToastStore.getState().toasts[useToastStore.getState().toasts.length - 1]?.message).toBe(
      'The current selection cannot be quoted to the AI chat.'
    );
  });

  it('does not queue serialized selections that are too large to insert into chat', () => {
    vi.mocked(getSerializedSelectionText).mockReturnValue(
      'x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS + 1)
    );

    const opened = openSidebarDiscussionForSelection(createView());

    expect(opened).toBe(false);
    expect(useUIStore.getState().pendingNotesChatComposerInsert).toBeNull();
    expect(useToastStore.getState().toasts[useToastStore.getState().toasts.length - 1]?.message).toBe(
      'The current selection cannot be quoted to the AI chat.'
    );
  });
});
