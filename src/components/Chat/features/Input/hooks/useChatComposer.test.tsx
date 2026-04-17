import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatComposer } from './useChatComposer';

const { registerComposerFocusAdapterMock, usePredictedTextareaHeightMock } = vi.hoisted(() => ({
  registerComposerFocusAdapterMock: vi.fn((_adapter: unknown) => vi.fn()),
  usePredictedTextareaHeightMock: vi.fn((_ref: unknown, _options: unknown) => {}),
}));

vi.mock('@/lib/ui/composerFocusRegistry', () => ({
  registerComposerFocusAdapter: (adapter: unknown) => registerComposerFocusAdapterMock(adapter),
}));

vi.mock('@/hooks/usePredictedTextareaHeight', () => ({
  usePredictedTextareaHeight: (ref: unknown, options: unknown) =>
    usePredictedTextareaHeightMock(ref, options),
}));

describe('useChatComposer', () => {
  it('clears the composer through predicted height updates after send', () => {
    const onSend = vi.fn();
    const onAfterSend = vi.fn();

    const { result } = renderHook(() =>
      useChatComposer({
        onSend,
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend,
      }),
    );

    expect(usePredictedTextareaHeightMock).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({ value: '' }),
    );

    act(() => {
      result.current.handleMessageChange('hello');
    });

    expect(usePredictedTextareaHeightMock).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({ value: 'hello' }),
    );

    act(() => {
      result.current.handleSend();
    });

    expect(onSend).toHaveBeenCalledWith('hello', [], []);
    expect(onAfterSend).toHaveBeenCalledTimes(1);
    expect(usePredictedTextareaHeightMock).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({ value: '' }),
    );
  });
});
