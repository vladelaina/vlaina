import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDiagnosticsLog, getDiagnosticsLogText } from '@/lib/diagnostics/diagnosticsLog';
import { useEditorSave } from './useEditorSave';
import { flushCurrentEditorSave } from '../utils/editorSaveRegistry';

describe('useEditorSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearDiagnosticsLog();
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

    await act(async () => {
      await flushCurrentEditorSave();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledWith({ explicit: false, throwOnError: true });
  });

  it('saves dirty editor state even when no debounced event is queued', async () => {
    const saveNote = vi.fn<(options?: { explicit?: boolean }) => Promise<void>>().mockResolvedValue();
    renderHook(() => useEditorSave(saveNote));

    await act(async () => {
      await flushCurrentEditorSave();
    });

    expect(saveNote).toHaveBeenCalledTimes(1);
    expect(saveNote).toHaveBeenCalledWith({ explicit: false, throwOnError: true });
  });

  it('retries a failed autosave and clears the pending queue after recovery', async () => {
    const saveNote = vi
      .fn<(options?: { explicit?: boolean }) => Promise<void>>()
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useEditorSave(saveNote));

    act(() => {
      result.current.debouncedSave();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(saveNote).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(saveNote).toHaveBeenCalledTimes(2);
    expect(saveNote).toHaveBeenLastCalledWith({ explicit: false, throwOnError: true });

    const report = JSON.parse(getDiagnosticsLogText());
    expect(report.entries).toContainEqual(expect.objectContaining({
      channel: 'note-save',
      event: 'autosave-write-failed',
      details: expect.objectContaining({
        willRetry: true,
        errorMessage: 'disk busy',
      }),
    }));
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
