import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorSave } from './useEditorSave';

describe('useEditorSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels pending debounced saves on unmount', async () => {
    const saveNote = vi.fn<(options?: { explicit?: boolean }) => Promise<void>>().mockResolvedValue();
    const { result, unmount } = renderHook(() => useEditorSave(saveNote));

    act(() => {
      result.current.debouncedSave();
    });

    unmount();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveNote).not.toHaveBeenCalled();
  });

  it('flushes pending debounced saves immediately', async () => {
    const saveNote = vi.fn<(options?: { explicit?: boolean }) => Promise<void>>().mockResolvedValue();
    const { result } = renderHook(() => useEditorSave(saveNote));

    act(() => {
      result.current.debouncedSave();
    });

    result.current.flushSave();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledWith({ explicit: false });
  });

  it('saves immediately for explicit saves', async () => {
    const saveNote = vi.fn<(options?: { explicit?: boolean }) => Promise<void>>().mockResolvedValue();
    const { result } = renderHook(() => useEditorSave(saveNote));

    result.current.flushSave(true);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledWith({ explicit: true });
  });
});
