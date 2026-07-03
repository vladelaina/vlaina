import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIBehaviorSettings } from './AIBehaviorSettings';

const aiStoreMock = vi.hoisted(() => ({
  customSystemPrompt: '',
  setCustomSystemPrompt: vi.fn(),
}));

vi.mock('@/stores/useAIStore', () => ({
  useAIStore: () => ({
    customSystemPrompt: aiStoreMock.customSystemPrompt,
    setCustomSystemPrompt: aiStoreMock.setCustomSystemPrompt,
  }),
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('AIBehaviorSettings', () => {
  afterEach(() => {
    cleanup();
    aiStoreMock.customSystemPrompt = '';
    aiStoreMock.setCustomSystemPrompt.mockReset();
  });

  it('does not commit the system prompt while IME composition is active', () => {
    const { unmount } = render(<AIBehaviorSettings />);
    const textarea = screen.getByRole('textbox');

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: 'nihao' } });
    fireEvent.blur(textarea);

    expect(aiStoreMock.setCustomSystemPrompt).not.toHaveBeenCalled();

    unmount();

    expect(aiStoreMock.setCustomSystemPrompt).not.toHaveBeenCalled();
  });

  it('commits the system prompt after IME composition ends', () => {
    render(<AIBehaviorSettings />);
    const textarea = screen.getByRole('textbox');

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: 'nihao' } });
    fireEvent.compositionEnd(textarea);
    fireEvent.change(textarea, { target: { value: '你好' } });
    fireEvent.blur(textarea);

    expect(aiStoreMock.setCustomSystemPrompt).toHaveBeenCalledWith('你好');
  });
});
