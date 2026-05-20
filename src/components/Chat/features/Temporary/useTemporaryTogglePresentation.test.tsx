import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTemporaryTogglePresentation } from './useTemporaryTogglePresentation';

const mocks = vi.hoisted(() => ({
  useUnifiedStore: vi.fn(),
  useAIUIStore: vi.fn(),
}));

vi.mock('@/stores/unified/useUnifiedStore', () => ({
  useUnifiedStore: mocks.useUnifiedStore,
}));

vi.mock('@/stores/ai/chatState', () => ({
  useAIUIStore: mocks.useAIUIStore,
}));

function mockState({
  temporaryChatEnabled,
  messages = [],
}: {
  temporaryChatEnabled: boolean;
  messages?: Array<{ role: string; content?: string }>;
}) {
  const uiState = {
    currentSessionId: 'session-1',
    temporaryChatEnabled,
  };
  const unifiedState = {
    data: {
      ai: {
        messages: {
          'session-1': messages,
        },
      },
    },
  };

  mocks.useAIUIStore.mockImplementation((selector: (state: typeof uiState) => unknown) => selector(uiState));
  mocks.useUnifiedStore.mockImplementation((selector: (state: typeof unifiedState) => unknown) => selector(unifiedState));
}

describe('useTemporaryTogglePresentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the title bar promote button hidden before temporary chat is enabled', () => {
    mockState({ temporaryChatEnabled: false });

    const { result } = renderHook(() => useTemporaryTogglePresentation());

    expect(result.current.showInTitleBar).toBe(false);
    expect(result.current.showInChatArea).toBe(true);
  });

  it('shows the title bar promote button only after temporary chat has a user message', () => {
    mockState({
      temporaryChatEnabled: true,
      messages: [{ role: 'user', content: 'Draft an outline' }],
    });

    const { result } = renderHook(() => useTemporaryTogglePresentation());

    expect(result.current.showInTitleBar).toBe(true);
    expect(result.current.showInChatArea).toBe(false);
  });
});
