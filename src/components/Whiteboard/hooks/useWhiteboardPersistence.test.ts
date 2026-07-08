import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WHITEBOARD_DOCUMENT_FORMAT,
  WHITEBOARD_DOCUMENT_VERSION,
  serializeWhiteboardSnapshot,
  type WhiteboardSnapshot,
} from '../model/whiteboardDocument';
import {
  MAX_WHITEBOARD_LOCAL_STORAGE_WRITE_BYTES,
  loadWhiteboardSnapshot,
  persistWhiteboardSnapshot,
  useWhiteboardPersistence,
} from './useWhiteboardPersistence';
import { useWhiteboardStore } from '../stores/useWhiteboardStore';

const storageKey = 'vlaina:whiteboard:v1';

const snapshot: WhiteboardSnapshot = {
  connectors: [],
  elements: [
    {
      height: 120,
      id: 'note-1',
      text: 'Saved note',
      type: 'note',
      width: 160,
      x: 10,
      y: 20,
    },
  ],
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

  it('writes snapshots as versioned whiteboard documents', async () => {
    const { result } = renderHook(() => useWhiteboardPersistence(snapshot));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current).toMatchObject({ ok: true });
    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '')).toEqual({
      content: snapshot,
      format: WHITEBOARD_DOCUMENT_FORMAT,
      version: WHITEBOARD_DOCUMENT_VERSION,
    });
  });

  it('binds delayed saves to the board that was active when the timer was scheduled', async () => {
    const saveActiveSnapshot = vi.fn(async () => ({ byteLength: 1, ok: true as const }));
    useWhiteboardStore.setState({
      activeBoardId: 'board-a',
      saveActiveSnapshot,
    });

    renderHook(() => useWhiteboardPersistence(snapshot));
    act(() => {
      useWhiteboardStore.setState({ activeBoardId: 'board-b' });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(saveActiveSnapshot).toHaveBeenCalledWith(snapshot, 'board-a');
  });

  it('does not persist while interaction persistence is paused', async () => {
    const { rerender, result } = renderHook(({ paused }) => useWhiteboardPersistence(snapshot, paused), {
      initialProps: { paused: true },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current).toBeNull();
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    rerender({ paused: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current).toMatchObject({ ok: true });
  });

  it('loads versioned documents and legacy snapshots', () => {
    window.localStorage.setItem(storageKey, serializeWhiteboardSnapshot(snapshot));
    expect(loadWhiteboardSnapshot()).toEqual(snapshot);

    window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    expect(loadWhiteboardSnapshot()).toEqual(snapshot);
  });

  it('does not overwrite the last saved board when a snapshot is too large for localStorage', () => {
    window.localStorage.setItem(storageKey, serializeWhiteboardSnapshot(snapshot));

    const result = persistWhiteboardSnapshot({
      ...snapshot,
      elements: [{ ...snapshot.elements[0], text: 'x'.repeat(MAX_WHITEBOARD_LOCAL_STORAGE_WRITE_BYTES + 1) }],
    });

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: 'too-large' });
    expect(loadWhiteboardSnapshot()).toEqual(snapshot);
  });

  it('reports localStorage write failures without throwing', () => {
    const setItem = vi.fn(() => {
      throw new Error('Quota exceeded');
    });

    expect(persistWhiteboardSnapshot(snapshot, { setItem } as unknown as Storage)).toMatchObject({
      ok: false,
      reason: 'write-failed',
    });
  });
});
