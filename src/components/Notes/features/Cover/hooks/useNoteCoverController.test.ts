import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearNoteCoverSnapshotCacheForTests,
  getStableNoteCoverEntrySnapshot,
  useNoteCoverController,
} from './useNoteCoverController';

const hoisted = vi.hoisted(() => {
  const setNoteCover = vi.fn();
  const storeRef: { state: any } = { state: null };

  const useNotesStore = ((selector?: (state: any) => any) => {
    return selector ? selector(storeRef.state) : storeRef.state;
  }) as any;
  useNotesStore.getState = () => storeRef.state;

  return { setNoteCover, storeRef, useNotesStore };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

vi.mock('@/stores/notes/storage', () => ({
  getCurrentNotesRootPath: () => '/active-notesRoot',
}));

vi.mock('@/lib/storage/adapter', () => ({
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? '' : normalized.slice(0, index);
  },
  isAbsolutePath: (path: string) => path.startsWith('/'),
}));

describe('useNoteCoverController', () => {
  beforeEach(() => {
    hoisted.setNoteCover.mockReset();
    clearNoteCoverSnapshotCacheForTests();

    hoisted.storeRef.state = {
      notesPath: '/notesRoot',
      noteMetadata: { notes: {} },
      currentNote: null,
      setNoteCover: hoisted.setNoteCover,
    };
  });

  it('returns note cover values from metadata and updates cover', () => {
    hoisted.storeRef.state.noteMetadata.notes['a.md'] = {
      cover: {
        assetPath: 'assets/a.png',
        positionX: 12,
        positionY: 24,
        height: 222,
        scale: 1.6,
      },
    };

    const { result } = renderHook(() => useNoteCoverController('a.md'));

    expect(result.current.cover).toEqual({
      url: 'assets/a.png',
      positionX: 12,
      positionY: 24,
      height: 222,
      scale: 1.6,
    });
    expect(result.current.notesRootPath).toBe('/notesRoot');
    expect(result.current.currentNotePath).toBe('a.md');

    act(() => {
      result.current.updateCover('assets/next.png', 30, 40, 260, 1.2);
    });

    expect(result.current.cover).toEqual({
      url: 'assets/next.png',
      positionX: 30,
      positionY: 40,
      height: 260,
      scale: 1.2,
    });
    expect(hoisted.setNoteCover).toHaveBeenCalledWith('a.md', {
      assetPath: 'assets/next.png',
      positionX: 30,
      positionY: 40,
      height: 260,
      scale: 1.2,
    });
  });

  it('uses defaults when note has no cover metadata', () => {
    const { result } = renderHook(() => useNoteCoverController('empty.md'));
    expect(result.current.cover).toEqual({
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    });
  });

  it('falls back to the current note frontmatter cover while metadata is not indexed yet', () => {
    hoisted.storeRef.state.currentNote = {
      path: 'frontmatter-cover.md',
      content: [
        '---',
        'vlaina_cover: "assets/frontmatter.png" x=22 y=33 height=244 scale=1.5',
        '---',
        '',
        '# Frontmatter Cover',
      ].join('\n'),
    };

    const { result } = renderHook(() => useNoteCoverController('frontmatter-cover.md'));

    expect(result.current.cover).toEqual({
      url: 'assets/frontmatter.png',
      positionX: 22,
      positionY: 33,
      height: 244,
      scale: 1.5,
    });
  });

  it('does not resurrect a cover from current content once metadata explicitly has no cover', () => {
    hoisted.storeRef.state.noteMetadata.notes['frontmatter-cover.md'] = {};
    hoisted.storeRef.state.currentNote = {
      path: 'frontmatter-cover.md',
      content: [
        '---',
        'vlaina_cover: "assets/stale.png" x=22 y=33 height=244 scale=1.5',
        '---',
        '',
        '# Frontmatter Cover',
      ].join('\n'),
    };

    const { result } = renderHook(() => useNoteCoverController('frontmatter-cover.md'));

    expect(result.current.cover).toEqual({
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    });
  });

  it('keeps the last loaded cover while a metadata refresh temporarily omits the note entry', () => {
    hoisted.storeRef.state.noteMetadata.notes['covered.md'] = {
      cover: {
        assetPath: 'assets/current.png',
        positionX: 30,
        positionY: 40,
        height: 260,
        scale: 1.2,
      },
    };

    const { result, rerender } = renderHook(() => useNoteCoverController('covered.md'));

    expect(result.current.cover).toEqual({
      url: 'assets/current.png',
      positionX: 30,
      positionY: 40,
      height: 260,
      scale: 1.2,
    });

    hoisted.storeRef.state.noteMetadata = { notes: {} };
    rerender();

    expect(result.current.cover).toEqual({
      url: 'assets/current.png',
      positionX: 30,
      positionY: 40,
      height: 260,
      scale: 1.2,
    });
  });

  it('returns the same cover snapshot reference when cover metadata is unchanged', () => {
    hoisted.storeRef.state.noteMetadata.notes['covered.md'] = {
      cover: {
        assetPath: 'assets/current.png',
        positionX: 30,
        positionY: 40,
        height: 260,
        scale: 1.2,
      },
    };

    const first = getStableNoteCoverEntrySnapshot('covered.md', hoisted.storeRef.state);
    const second = getStableNoteCoverEntrySnapshot('covered.md', hoisted.storeRef.state);

    expect(second).toBe(first);

    hoisted.storeRef.state.noteMetadata = {
      notes: {
        'covered.md': {
          cover: {
            assetPath: 'assets/current.png',
            positionX: 30,
            positionY: 40,
            height: 260,
            scale: 1.2,
          },
        },
      },
    };

    const third = getStableNoteCoverEntrySnapshot('covered.md', hoisted.storeRef.state);
    expect(third).toBe(first);
  });

  it('does not reuse a temporarily missing cover cache across notes-roots for the same note path', () => {
    hoisted.storeRef.state.notesPath = '/notes-root-a';
    hoisted.storeRef.state.noteMetadata.notes['covered.md'] = {
      cover: {
        assetPath: 'assets/notes-root-a.png',
        positionX: 30,
        positionY: 40,
        height: 260,
        scale: 1.2,
      },
    };

    const { result, rerender } = renderHook(() => useNoteCoverController('covered.md'));
    expect(result.current.cover.url).toBe('assets/notes-root-a.png');

    hoisted.storeRef.state.notesPath = '/notes-root-b';
    hoisted.storeRef.state.noteMetadata = { notes: {} };
    rerender();

    expect(result.current.cover).toEqual({
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    });
  });

  it('optimistically removes the cover before metadata persistence catches up', () => {
    hoisted.storeRef.state.noteMetadata.notes['covered.md'] = {
      cover: {
        assetPath: 'assets/current.png',
        positionX: 30,
        positionY: 40,
        height: 260,
        scale: 1.2,
      },
    };

    const { result } = renderHook(() => useNoteCoverController('covered.md'));

    act(() => {
      result.current.updateCover(null, 50, 50);
    });

    expect(result.current.cover).toEqual({
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    });
    expect(hoisted.setNoteCover).toHaveBeenCalledWith('covered.md', null);
  });

  it('keeps optimistic crop changes until matching metadata catches up', () => {
    hoisted.storeRef.state.noteMetadata.notes['covered.md'] = {
      cover: {
        assetPath: 'assets/current.png',
        positionX: 30,
        positionY: 40,
        height: 260,
        scale: 1.2,
      },
    };

    const { result, rerender } = renderHook(() => useNoteCoverController('covered.md'));

    act(() => {
      result.current.updateCover('assets/current.png', 60, 70, 280, 1.4);
    });

    expect(result.current.cover).toEqual({
      url: 'assets/current.png',
      positionX: 60,
      positionY: 70,
      height: 280,
      scale: 1.4,
    });

    rerender();

    expect(result.current.cover).toEqual({
      url: 'assets/current.png',
      positionX: 60,
      positionY: 70,
      height: 280,
      scale: 1.4,
    });

    hoisted.storeRef.state.noteMetadata = {
      notes: {
        'covered.md': {
          cover: {
            assetPath: 'assets/current.png',
            positionX: 60,
            positionY: 70,
            height: 280,
            scale: 1.4,
          },
        },
      },
    };
    rerender();

    expect(result.current.cover).toEqual({
      url: 'assets/current.png',
      positionX: 60,
      positionY: 70,
      height: 280,
      scale: 1.4,
    });
  });

  it('falls back to the active notesRoot while notesPath is temporarily empty', () => {
    hoisted.storeRef.state.notesPath = '';

    const { result } = renderHook(() => useNoteCoverController('empty.md'));

    expect(result.current.notesRootPath).toBe('/active-notesRoot');
  });

  it('opens picker without assigning a cover', () => {
    const { result } = renderHook(() => useNoteCoverController('blank.md'));

    act(() => {
      result.current.openCoverPicker();
    });

    expect(result.current.isPickerOpen).toBe(true);
    expect(hoisted.setNoteCover).not.toHaveBeenCalled();
  });

  it('closes picker when current note changes', () => {
    const { result, rerender } = renderHook(
      ({ notePath }) => useNoteCoverController(notePath),
      { initialProps: { notePath: 'a.md' as string | undefined } }
    );

    act(() => {
      result.current.setPickerOpen(true);
    });
    expect(result.current.isPickerOpen).toBe(true);

    rerender({ notePath: 'b.md' });
    expect(result.current.isPickerOpen).toBe(false);
  });

  it('does not expose a picker opened for another note', () => {
    const { result, rerender } = renderHook(
      ({ notePath }) => useNoteCoverController(notePath),
      { initialProps: { notePath: 'a.md' as string | undefined } }
    );

    act(() => {
      result.current.setPickerOpen(true);
    });
    expect(result.current.isPickerOpen).toBe(true);

    rerender({ notePath: 'b.md' });
    expect(result.current.isPickerOpen).toBe(false);
    expect(result.current.cover).toEqual({
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    });
  });

  it('does not expose optimistic cover state for another note', () => {
    const { result, rerender } = renderHook(
      ({ notePath }) => useNoteCoverController(notePath),
      { initialProps: { notePath: 'a.md' as string | undefined } }
    );

    act(() => {
      result.current.updateCover('assets/a.png', 25, 35, 240, 1.3);
    });
    expect(result.current.cover.url).toBe('assets/a.png');

    rerender({ notePath: 'b.md' });
    expect(result.current.cover).toEqual({
      url: null,
      positionX: 50,
      positionY: 50,
      height: undefined,
      scale: 1,
    });
  });
});
