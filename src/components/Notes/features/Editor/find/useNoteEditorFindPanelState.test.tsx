import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchEditorFindOpenEvent } from './editorFindEvents';
import { useNoteEditorFindPanelState } from './useNoteEditorFindPanelState';

describe('useNoteEditorFindPanelState', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('opens from the global event and re-focuses the query input on repeated open', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useNoteEditorFindPanelState({
        notePath: 'note-a',
        hasQuery: false,
        onClose,
      }),
    );

    const input = document.createElement('input');
    const focusSpy = vi.spyOn(input, 'focus');
    const selectSpy = vi.spyOn(input, 'select');
    result.current.inputRef.current = input;

    act(() => {
      dispatchEditorFindOpenEvent();
    });

    expect(result.current.isOpen).toBe(true);
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(selectSpy).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchEditorFindOpenEvent();
    });

    expect(focusSpy).toHaveBeenCalledTimes(2);
    expect(selectSpy).toHaveBeenCalledTimes(2);
  });

  it('does not open replace controls until a query exists', () => {
    const { result, rerender } = renderHook(
      ({ hasQuery }) =>
        useNoteEditorFindPanelState({
          notePath: 'note-a',
          hasQuery,
          onClose: vi.fn(),
        }),
      {
        initialProps: {
          hasQuery: false,
        },
      },
    );

    act(() => {
      result.current.toggleReplace();
    });

    expect(result.current.isReplaceOpen).toBe(false);

    rerender({ hasQuery: true });

    act(() => {
      result.current.toggleReplace();
    });

    expect(result.current.isReplaceOpen).toBe(true);
  });

  it('automatically closes replace controls when the query becomes empty', () => {
    const { result, rerender } = renderHook(
      ({ hasQuery }) =>
        useNoteEditorFindPanelState({
          notePath: 'note-a',
          hasQuery,
          onClose: vi.fn(),
        }),
      {
        initialProps: {
          hasQuery: true,
        },
      },
    );

    act(() => {
      result.current.toggleReplace();
    });

    expect(result.current.isReplaceOpen).toBe(true);

    rerender({ hasQuery: false });

    expect(result.current.isReplaceOpen).toBe(false);
  });

  it('closes and resets replace state when the note changes', () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      ({ notePath }) =>
        useNoteEditorFindPanelState({
          notePath,
          hasQuery: true,
          onClose,
        }),
      {
        initialProps: {
          notePath: 'note-a',
        },
      },
    );

    act(() => {
      result.current.open();
      result.current.toggleReplace();
      result.current.setReplaceValue('updated');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.isReplaceOpen).toBe(true);
    expect(result.current.replaceValue).toBe('updated');

    rerender({ notePath: 'note-b' });

    expect(onClose).toHaveBeenCalledWith(false);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isReplaceOpen).toBe(false);
    expect(result.current.replaceValue).toBe('');
  });
});
