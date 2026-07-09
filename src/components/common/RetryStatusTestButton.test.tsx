import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '@/stores/uiSlice';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { requestManager } from '@/lib/ai/requestManager';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
import { RetryStatusTestButton } from './RetryStatusTestButton';

vi.mock('@/lib/ui/composerFocusRegistry', () => ({
  focusComposerInput: vi.fn(),
}));

describe('RetryStatusTestButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(focusComposerInput).mockClear();
    useUIStore.setState({ languagePreference: 'zh-CN' });
    useUnifiedStore.setState({
      loaded: true,
      data: {
        settings: {
          timezone: { offset: 8, city: 'Asia/Shanghai' },
        } as never,
        customIcons: [],
        ai: {
          providers: [],
          models: [{
            id: 'model-1',
            apiModelId: 'model-1',
            name: 'Model',
            providerId: 'provider-1',
            enabled: true,
            createdAt: 1,
          }],
          benchmarkResults: {},
          fetchedModels: {},
          sessions: [{ id: 'session-1', title: 'Chat', modelId: 'model-1', createdAt: 1, updatedAt: 1 }],
          messages: { 'session-1': [] },
          unreadSessionIds: [],
          selectedModelId: 'model-1',
          currentSessionId: 'session-1',
          temporaryChatEnabled: false,
          customSystemPrompt: '',
          includeTimeContext: false,
          webSearchEnabled: false,
        },
      },
      undoStack: [],
    });
    useAIUIStore.setState({
      currentSessionId: 'session-1',
      temporaryChatEnabled: false,
      selectionInitialized: true,
    });
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.useRealTimers();
  });

  it('shows the localized retry countdown in the assistant message position', async () => {
    render(<RetryStatusTestButton />);

    const button = screen.getByRole('button', { name: '测试重试' });
    fireEvent.click(button);

    await vi.waitFor(() => {
      const messages = useUnifiedStore.getState().data.ai?.messages['session-1'] || [];
      expect(messages.at(-1)).toMatchObject({
        role: 'assistant',
        content: 'Service unavailable\n30秒后重试 - 第4次重试',
      });
    });
    expect(useAIUIStore.getState().generatingSessions).toEqual({ 'session-1': true });
    expect(focusComposerInput).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    const messages = useUnifiedStore.getState().data.ai?.messages['session-1'] || [];
    expect(messages.at(-1)?.content).toBe('Service unavailable\n29秒后重试 - 第4次重试');

    await act(async () => {
      requestManager.abort('session-1');
      await vi.advanceTimersByTimeAsync(0);
    });
    await vi.waitFor(() => {
      expect(useAIUIStore.getState().generatingSessions).toEqual({});
    });
  });

  it('stops the preview countdown when the current request is paused', async () => {
    render(<RetryStatusTestButton />);

    fireEvent.click(screen.getByRole('button', { name: '测试重试' }));
    await vi.waitFor(() => {
      const messages = useUnifiedStore.getState().data.ai?.messages['session-1'] || [];
      expect(messages.at(-1)?.content).toBe('Service unavailable\n30秒后重试 - 第4次重试');
    });
    await act(async () => {
      requestManager.abort('session-1');
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const messages = useUnifiedStore.getState().data.ai?.messages['session-1'] || [];
    expect(messages.at(-1)?.content).toBe('Service unavailable\n30秒后重试 - 第4次重试');
    expect(useAIUIStore.getState().generatingSessions).toEqual({});
  });
});
