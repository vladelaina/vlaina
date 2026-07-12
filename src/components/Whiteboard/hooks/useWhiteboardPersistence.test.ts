import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WhiteboardSnapshot } from '../model/whiteboardDocument';
import { useWhiteboardPersistence } from './useWhiteboardPersistence';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

const snapshot: WhiteboardSnapshot = {
  connectors: [],
  elements: [{
    height: 120,
    id: 'note-1',
    text: 'Saved note',
    type: 'note',
    width: 160,
    x: 10,
    y: 20,
  }],
  paper: 'ruled',
  strokes: [],
  viewport: { x: 1, y: 2, zoom: 1 },
};

describe('useWhiteboardPersistence', () => {
  beforeEach(() => {
    useWhiteboardStore.setState(useWhiteboardStore.getInitialState(), true);
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      useWhiteboardStore.setState(useWhiteboardStore.getInitialState(), true);
    });
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('saves only through the active system whiteboard store', async () => {
    const saveActiveSnapshot = vi.fn(async () => ({ byteLength: 1, ok: true as const }));
    useWhiteboardStore.setState({ activeBoardId: 'board-a', saveActiveSnapshot });
    const { result } = renderHook(() => useWhiteboardPersistence(snapshot));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(saveActiveSnapshot).toHaveBeenCalledWith(snapshot, 'board-a');
    expect(result.current).toEqual({ byteLength: 1, ok: true });
    expect(window.localStorage.getItem('vlaina:whiteboard:v1')).toBeNull();
  });

  it('binds delayed saves to the board that was active when the timer was scheduled', async () => {
    const saveActiveSnapshot = vi.fn(async () => ({ byteLength: 1, ok: true as const }));
    useWhiteboardStore.setState({ activeBoardId: 'board-a', saveActiveSnapshot });
    renderHook(() => useWhiteboardPersistence(snapshot));
    act(() => useWhiteboardStore.setState({ activeBoardId: 'board-b' }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(saveActiveSnapshot).toHaveBeenCalledWith(snapshot, 'board-a');
  });

  it('does not persist while interaction persistence is paused', async () => {
    const saveActiveSnapshot = vi.fn(async () => ({ byteLength: 1, ok: true as const }));
    useWhiteboardStore.setState({ activeBoardId: 'board-a', saveActiveSnapshot });
    const { rerender, result } = renderHook(({ paused }) => useWhiteboardPersistence(snapshot, paused), {
      initialProps: { paused: true },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBeNull();
    expect(saveActiveSnapshot).not.toHaveBeenCalled();

    rerender({ paused: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(saveActiveSnapshot).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable storage instead of falling back to localStorage', async () => {
    const { result } = renderHook(() => useWhiteboardPersistence(snapshot));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current).toEqual({ byteLength: 0, ok: false, reason: 'storage-unavailable' });
    expect(window.localStorage.getItem('vlaina:whiteboard:v1')).toBeNull();
  });
});
