import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useUIStore } from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { TOOLBAR_ACTIONS } from '../types';
import { openSidebarDiscussionForSelection } from './sidebarDiscussion';

vi.mock('./selectionCommands', () => ({
  getSerializedSelectionText: vi.fn(),
}));

vi.mock('@/stores/useAIStore', () => ({
  createAIChatSession: vi.fn(),
}));

import { createAIChatSession } from '@/stores/useAIStore';
import { getSerializedSelectionText } from './selectionCommands';

function createView(): EditorView {
  return {
    state: {
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
      pendingNotesChatComposerInsert: null,
    });
    useUnifiedStore.setState((state) => ({
      ...state,
      data: {
        ...state.data,
        ai: {
          ...state.data.ai!,
          currentSessionId: 'session-1',
        },
      },
    }));
    vi.mocked(createAIChatSession).mockReset();
    vi.mocked(getSerializedSelectionText).mockReset();
  });

  it('queues the normalized selection into the current side chat and hides the toolbar', () => {
    vi.mocked(getSerializedSelectionText).mockReturnValue('Selected line 1\n\n\nSelected line 2');
    const view = createView();

    const opened = openSidebarDiscussionForSelection(view);

    expect(opened).toBe(true);
    expect(useUIStore.getState().notesChatPanelCollapsed).toBe(false);
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('Selected line 1\n\nSelected line 2');
    expect(view.dispatch).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TOOLBAR_ACTIONS.HIDE,
      })
    );
  });

  it('creates a new session before queuing when the side chat is collapsed', () => {
    useUIStore.setState({
      notesChatPanelCollapsed: true,
      pendingNotesChatComposerInsert: null,
    });
    vi.mocked(getSerializedSelectionText).mockReturnValue('Selected line 1');

    openSidebarDiscussionForSelection(createView());

    expect(createAIChatSession).toHaveBeenCalledWith('');
    expect(useUIStore.getState().pendingNotesChatComposerInsert?.text).toBe('Selected line 1');
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
});
