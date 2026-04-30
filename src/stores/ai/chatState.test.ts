import { afterEach, describe, expect, it } from 'vitest';
import { useAIUIStore } from './chatState';

describe('AI chat UI state', () => {
  afterEach(() => {
    useAIUIStore.setState({
      generatingSessions: {},
      unreadSessions: {},
      error: null,
      currentSessionId: null,
      temporaryChatEnabled: false,
      selectionInitialized: false,
      temporaryReturnSessionId: null,
    });
  });

  it('removes completed generation sessions instead of retaining false entries', () => {
    const store = useAIUIStore.getState();

    store.setSessionLoading('session-1', true);
    expect(useAIUIStore.getState().generatingSessions).toEqual({
      'session-1': true,
    });

    store.setSessionLoading('session-1', false);
    expect(useAIUIStore.getState().generatingSessions).toEqual({});
  });
});
