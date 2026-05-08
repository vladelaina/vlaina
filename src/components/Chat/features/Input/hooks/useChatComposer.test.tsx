import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatComposer } from './useChatComposer';

const { registerComposerFocusAdapterMock, syncHeightMock, usePredictedTextareaHeightMock } = vi.hoisted(() => ({
  registerComposerFocusAdapterMock: vi.fn((_adapter: unknown) => vi.fn()),
  syncHeightMock: vi.fn(),
  usePredictedTextareaHeightMock: vi.fn((_ref: unknown, _options: unknown) => {}),
}));

vi.mock('@/lib/ui/composerFocusRegistry', () => ({
  registerComposerFocusAdapter: (adapter: unknown) => registerComposerFocusAdapterMock(adapter),
}));

vi.mock('@/hooks/usePredictedTextareaHeight', () => ({
  usePredictedTextareaHeight: (ref: unknown, options: unknown) => {
    usePredictedTextareaHeightMock(ref, options);
    return { syncHeight: syncHeightMock };
  },
}));

describe('useChatComposer', () => {
  beforeEach(() => {
    syncHeightMock.mockClear();
    usePredictedTextareaHeightMock.mockClear();
  });

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

  it('blocks send and Enter submission while submit is disabled', () => {
    const onSend = vi.fn();
    const onAfterSend = vi.fn();
    const preventDefault = vi.fn();

    const { result } = renderHook(() =>
      useChatComposer({
        onSend,
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend,
        canSubmit: false,
      }),
    );

    act(() => {
      result.current.handleMessageChange('next message');
    });

    act(() => {
      result.current.handleKeyDown({
        key: 'Enter',
        shiftKey: false,
        preventDefault,
        nativeEvent: {},
      } as any);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(onAfterSend).not.toHaveBeenCalled();
    expect(result.current.message).toBe('next message');
  });

  it('syncs textarea height right after Shift+Enter inserts a newline', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        rafCallbacks.push(callback);
        return rafCallbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});

    try {
      const { result } = renderHook(() =>
        useChatComposer({
          onSend: vi.fn(),
          attachments: [],
          getNoteMentions: () => [],
          onAfterSend: vi.fn(),
        }),
      );

      act(() => {
        result.current.handleKeyDown({
          key: 'Enter',
          shiftKey: true,
          nativeEvent: {},
        } as any);
      });

      expect(syncHeightMock).not.toHaveBeenCalled();

      act(() => {
        rafCallbacks[0]?.(0);
      });

      expect(syncHeightMock).toHaveBeenCalledTimes(1);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });
});
