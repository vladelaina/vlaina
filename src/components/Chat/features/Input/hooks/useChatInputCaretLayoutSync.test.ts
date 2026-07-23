import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NATIVE_CARET_OVERLAY_REFRESH_EVENT } from '@/hooks/useNativeCaretOverlay';
import {
  shouldRefocusMovedCaret,
  useChatInputCaretLayoutSync,
} from './useChatInputCaretLayoutSync';

afterEach(() => {
  document.body.replaceChildren();
});

describe('shouldRefocusMovedCaret', () => {
  const initial = { height: 24, left: 100, top: 500, width: 240 };

  it('detects a focused textarea moved by content inserted before it', () => {
    expect(shouldRefocusMovedCaret(
      initial,
      { ...initial, top: 550 },
      true,
      false,
    )).toBe(true);
  });

  it('ignores normal textarea growth while typing', () => {
    expect(shouldRefocusMovedCaret(
      initial,
      { ...initial, height: 48, top: 476 },
      true,
      false,
    )).toBe(false);
  });

  it('detects a width-driven layout change even when wrapping also changes height', () => {
    expect(shouldRefocusMovedCaret(
      initial,
      { ...initial, height: 48, left: 80, top: 476, width: 180 },
      true,
      false,
    )).toBe(true);
  });

  it('does not interrupt composition or an unfocused textarea', () => {
    const moved = { ...initial, top: 550 };
    expect(shouldRefocusMovedCaret(initial, moved, true, true)).toBe(false);
    expect(shouldRefocusMovedCaret(initial, moved, false, false)).toBe(false);
  });
});

describe('useChatInputCaretLayoutSync', () => {
  it('refreshes a focused caret after the composer is programmatically cleared', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    const handleRefresh = vi.fn();
    document.addEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, handleRefresh);

    const { rerender } = renderHook(
      ({ message }) => useChatInputCaretLayoutSync({
        composerRootRef: { current: null },
        isComposing: false,
        message,
        scheduleComposerRefocus: vi.fn(),
        textareaRef: { current: textarea },
      }),
      { initialProps: { message: 'hello' } },
    );

    rerender({ message: '' });

    expect(handleRefresh).toHaveBeenCalledTimes(1);
    document.removeEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, handleRefresh);
  });

  it('does not refresh while the composer remains populated or unfocused', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const handleRefresh = vi.fn();
    document.addEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, handleRefresh);

    const { rerender } = renderHook(
      ({ message }) => useChatInputCaretLayoutSync({
        composerRootRef: { current: null },
        isComposing: false,
        message,
        scheduleComposerRefocus: vi.fn(),
        textareaRef: { current: textarea },
      }),
      { initialProps: { message: 'hello' } },
    );

    rerender({ message: 'hello again' });
    rerender({ message: '' });

    expect(handleRefresh).not.toHaveBeenCalled();
    document.removeEventListener(NATIVE_CARET_OVERLAY_REFRESH_EVENT, handleRefresh);
  });
});
