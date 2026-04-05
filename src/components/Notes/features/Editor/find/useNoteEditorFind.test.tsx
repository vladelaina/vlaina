import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorFindMatch } from '../plugins/find';

const mocks = vi.hoisted(() => ({
  clearEditorFindMock: vi.fn(),
  getEditorFindSnapshotMock: vi.fn(),
  replaceAllEditorFindMatchesMock: vi.fn(),
  replaceCurrentEditorFindMatchMock: vi.fn(),
  setEditorFindQueryMock: vi.fn(),
  stepEditorFindMatchMock: vi.fn(),
  subscribeEditorFindSnapshotMock: vi.fn(() => () => {}),
  getCurrentEditorViewMock: vi.fn(),
}));

vi.mock('../plugins/find', () => ({
  clearEditorFind: mocks.clearEditorFindMock,
  getEditorFindSnapshot: mocks.getEditorFindSnapshotMock,
  replaceAllEditorFindMatches: mocks.replaceAllEditorFindMatchesMock,
  replaceCurrentEditorFindMatch: mocks.replaceCurrentEditorFindMatchMock,
  setEditorFindQuery: mocks.setEditorFindQueryMock,
  stepEditorFindMatch: mocks.stepEditorFindMatchMock,
  subscribeEditorFindSnapshot: mocks.subscribeEditorFindSnapshotMock,
}));

vi.mock('../utils/editorViewRegistry', () => ({
  getCurrentEditorView: mocks.getCurrentEditorViewMock,
}));

import { useNoteEditorFind } from './useNoteEditorFind';

function createMatch(from: number, to: number): EditorFindMatch {
  return {
    from,
    to,
    ranges: [{ from, to }],
  };
}

describe('useNoteEditorFind', () => {
  let currentSnapshot: {
    query: string;
    matches: EditorFindMatch[];
    activeIndex: number;
    view: { focus: ReturnType<typeof vi.fn> } | null;
    version: number;
  };

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    currentSnapshot = {
      query: 'beta',
      matches: [createMatch(2, 6), createMatch(10, 14)],
      activeIndex: 0,
      view: {
        focus: vi.fn(),
      },
      version: 1,
    };

    mocks.getEditorFindSnapshotMock.mockImplementation(() => currentSnapshot);
    mocks.getCurrentEditorViewMock.mockReturnValue(currentSnapshot.view);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('delegates query updates to the fallback editor view when the snapshot view is missing', () => {
    const fallbackView = { focus: vi.fn() };
    currentSnapshot.view = null;
    mocks.getCurrentEditorViewMock.mockReturnValue(fallbackView);

    const { result } = renderHook(() => useNoteEditorFind('note-a'));

    act(() => {
      result.current.setQuery('gamma');
    });

    expect(mocks.setEditorFindQueryMock).toHaveBeenCalledWith(fallbackView, 'gamma');
  });

  it('navigates between matches from the query input keyboard handler', () => {
    const { result } = renderHook(() => useNoteEditorFind('note-a'));
    const preventDefault = vi.fn();

    act(() => {
      result.current.handleQueryKeyDown({
        key: 'Enter',
        shiftKey: false,
        preventDefault,
      } as never);
    });

    act(() => {
      result.current.handleQueryKeyDown({
        key: 'Enter',
        shiftKey: true,
        preventDefault,
      } as never);
    });

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(mocks.stepEditorFindMatchMock.mock.calls).toEqual([
      [currentSnapshot.view, 1],
      [currentSnapshot.view, -1],
    ]);
  });

  it('closes the panel with Escape, clears find state, and restores editor focus', () => {
    const { result } = renderHook(() => useNoteEditorFind('note-a'));
    const preventDefault = vi.fn();

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.handleQueryKeyDown({
        key: 'Escape',
        preventDefault,
      } as never);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(result.current.isOpen).toBe(false);
    expect(mocks.clearEditorFindMock).toHaveBeenCalledWith(currentSnapshot.view);
    expect(currentSnapshot.view?.focus).toHaveBeenCalledTimes(1);
  });

  it('replaces the current match from the replace input keyboard handler', () => {
    const { result } = renderHook(() => useNoteEditorFind('note-a'));
    const preventDefault = vi.fn();

    act(() => {
      result.current.setReplaceValue('updated');
    });

    act(() => {
      result.current.handleReplaceKeyDown({
        key: 'Enter',
        preventDefault,
      } as never);
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(mocks.replaceCurrentEditorFindMatchMock).toHaveBeenCalledWith(
      currentSnapshot.view,
      'updated',
    );
  });
});
