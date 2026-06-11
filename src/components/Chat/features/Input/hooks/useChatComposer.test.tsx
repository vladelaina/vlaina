import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS } from '@/lib/ui/composerFocusRegistry';
import { useChatComposer } from './useChatComposer';

const {
  registerComposerFocusAdapterMock,
  syncHeightMock,
  usePredictedTextareaHeightMock,
  testMaxComposerProgrammaticInsertChars,
} = vi.hoisted(() => ({
  registerComposerFocusAdapterMock: vi.fn((_adapter: unknown) => vi.fn()),
  syncHeightMock: vi.fn(),
  usePredictedTextareaHeightMock: vi.fn((_ref: unknown, _options: unknown) => {}),
  testMaxComposerProgrammaticInsertChars: 1024 * 1024,
}));

vi.mock('@/lib/ui/composerFocusRegistry', () => ({
  MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS: testMaxComposerProgrammaticInsertChars,
  canInsertTextIntoComposerValue: (currentText: string, text: string) => {
    if (!text || text.length > testMaxComposerProgrammaticInsertChars) {
      return false;
    }
    const separatorLength = currentText && !currentText.endsWith('\n') ? 1 : 0;
    return currentText.length + separatorLength + text.length <= testMaxComposerProgrammaticInsertChars;
  },
  registerComposerFocusAdapter: (adapter: unknown) => registerComposerFocusAdapterMock(adapter),
  isMountedVisibleElement: (element: HTMLElement | null) =>
    !!element && element.isConnected && element.getClientRects().length > 0,
  focusVisibleTextareaAt: (input: HTMLTextAreaElement | null, position?: number) => {
    if (!input || !input.isConnected || input.getClientRects().length === 0) {
      return false;
    }
    input.focus({ preventScroll: true });
    if (document.activeElement !== input) {
      return false;
    }
    const nextPosition = position ?? input.value.length;
    input.setSelectionRange(nextPosition, nextPosition);
    return true;
  },
}));

vi.mock('@/hooks/usePredictedTextareaHeight', () => ({
  usePredictedTextareaHeight: (ref: unknown, options: unknown) => {
    usePredictedTextareaHeightMock(ref, options);
    return { syncHeight: syncHeightMock };
  },
}));

describe('useChatComposer', () => {
  beforeEach(() => {
    registerComposerFocusAdapterMock.mockClear();
    syncHeightMock.mockClear();
    usePredictedTextareaHeightMock.mockClear();
    document.body.innerHTML = '';
  });

  it('does not register the global focus adapter while inactive', () => {
    renderHook(() =>
      useChatComposer({
        active: false,
        onSend: vi.fn(),
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend: vi.fn(),
      }),
    );

    expect(registerComposerFocusAdapterMock).not.toHaveBeenCalled();
  });

  it('unregisters the global focus adapter when becoming inactive', () => {
    const unregister = vi.fn();
    registerComposerFocusAdapterMock.mockReturnValueOnce(unregister);

    const { rerender } = renderHook(
      ({ active }) =>
        useChatComposer({
          active,
          onSend: vi.fn(),
          attachments: [],
          getNoteMentions: () => [],
          onAfterSend: vi.fn(),
        }),
      { initialProps: { active: true } },
    );

    expect(registerComposerFocusAdapterMock).toHaveBeenCalledTimes(1);

    rerender({ active: false });

    expect(unregister).toHaveBeenCalledTimes(1);
  });

  it('rejects global focus and insert while editing is disabled', () => {
    const { result } = renderHook(() =>
      useChatComposer({
        onSend: vi.fn(),
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend: vi.fn(),
        canEdit: false,
      }),
    );
    const root = document.createElement('div');
    root.getClientRects = () => [{ width: 240, height: 84 }] as unknown as DOMRectList;
    const textarea = document.createElement('textarea');
    textarea.getClientRects = () => [{ width: 240, height: 48 }] as unknown as DOMRectList;
    root.appendChild(textarea);
    document.body.appendChild(root);
    result.current.composerRootRef.current = root;
    result.current.textareaRef.current = textarea;
    const adapter = registerComposerFocusAdapterMock.mock.calls[0]?.[0] as {
      focus: () => boolean;
      insertText: (text: string) => boolean;
    };

    expect(adapter.focus()).toBe(false);
    act(() => {
      expect(adapter.insertText('blocked text')).toBe(false);
    });
    expect(result.current.message).toBe('');
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

  it('keeps the composer content when async send is not accepted', async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const onAfterSend = vi.fn();

    const { result } = renderHook(() =>
      useChatComposer({
        onSend,
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend,
      }),
    );

    act(() => {
      result.current.handleMessageChange('keep me');
    });

    act(() => {
      result.current.handleSend();
    });

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    expect(onAfterSend).not.toHaveBeenCalled();
    expect(result.current.message).toBe('keep me');
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

  it('scrolls the composer textarea to the bottom after inserting long text', () => {
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
      const root = document.createElement('div');
      root.getClientRects = () => [{ width: 240, height: 84 }] as unknown as DOMRectList;
      const textarea = document.createElement('textarea');
      textarea.getClientRects = () => [{ width: 240, height: 48 }] as unknown as DOMRectList;
      Object.defineProperty(textarea, 'scrollHeight', {
        value: 960,
        configurable: true,
      });
      root.appendChild(textarea);
      document.body.appendChild(root);
      result.current.composerRootRef.current = root;
      result.current.textareaRef.current = textarea;
      const adapter = registerComposerFocusAdapterMock.mock.calls[0]?.[0] as {
        insertText: (text: string) => boolean;
      };

      act(() => {
        expect(adapter.insertText('first\nsecond\nthird')).toBe(true);
      });
      textarea.value = result.current.message;

      act(() => {
        rafCallbacks[0]?.(0);
      });

      expect(textarea.selectionStart).toBe(textarea.value.length);
      expect(textarea.scrollTop).toBe(960);
      expect(syncHeightMock).toHaveBeenCalledWith(textarea.value);
    } finally {
      requestAnimationFrameSpy.mockRestore();
      cancelAnimationFrameSpy.mockRestore();
    }
  });

  it('rejects global composer inserts that would exceed the composer budget', () => {
    const { result } = renderHook(() =>
      useChatComposer({
        onSend: vi.fn(),
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend: vi.fn(),
      }),
    );
    const adapter = registerComposerFocusAdapterMock.mock.calls[0]?.[0] as {
      insertText: (text: string) => boolean;
    };

    act(() => {
      expect(adapter.insertText('x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS))).toBe(true);
    });
    act(() => {
      expect(adapter.insertText('next')).toBe(false);
    });

    expect(result.current.message).toBe('x'.repeat(MAX_COMPOSER_PROGRAMMATIC_INSERT_CHARS));
  });

  it('does not report global focus success for a hidden mounted composer', () => {
    const { result } = renderHook(() =>
      useChatComposer({
        onSend: vi.fn(),
        attachments: [],
        getNoteMentions: () => [],
        onAfterSend: vi.fn(),
      }),
    );
    const root = document.createElement('div');
    root.getClientRects = () => [] as unknown as DOMRectList;
    const textarea = document.createElement('textarea');
    textarea.getClientRects = () => [] as unknown as DOMRectList;
    root.appendChild(textarea);
    document.body.appendChild(root);
    result.current.composerRootRef.current = root;
    result.current.textareaRef.current = textarea;
    const adapter = registerComposerFocusAdapterMock.mock.calls[0]?.[0] as {
      focus: () => boolean;
    };

    expect(adapter.focus()).toBe(false);
  });
});
