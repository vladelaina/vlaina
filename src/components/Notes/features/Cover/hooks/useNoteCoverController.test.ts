import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNoteCoverController } from './useNoteCoverController';

const hoisted = vi.hoisted(() => {
  const setNoteCover = vi.fn();
  const getAssetList = vi.fn();
  const getRandomBuiltinCover = vi.fn(() => 'builtin:covers/default');
  const storeRef: { state: any } = { state: null };

  const useNotesStore = ((selector?: (state: any) => any) => {
    return selector ? selector(storeRef.state) : storeRef.state;
  }) as any;
  useNotesStore.getState = () => storeRef.state;

  return { setNoteCover, getAssetList, getRandomBuiltinCover, storeRef, useNotesStore };
});

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: hoisted.useNotesStore,
}));

vi.mock('@/lib/assets/builtinCovers', () => ({
  getRandomBuiltinCover: () => hoisted.getRandomBuiltinCover(),
}));

describe('useNoteCoverController', () => {
  beforeEach(() => {
    hoisted.setNoteCover.mockReset();
    hoisted.getAssetList.mockReset();
    hoisted.getRandomBuiltinCover.mockClear();

    hoisted.storeRef.state = {
      notesPath: '/vault',
      noteMetadata: { notes: {} },
      setNoteCover: hoisted.setNoteCover,
      getAssetList: hoisted.getAssetList,
    };
  });

  it('returns note cover values from metadata and updates cover', () => {
    hoisted.storeRef.state.noteMetadata.notes['a.md'] = {
      cover: {
        assetPath: 'covers/a.png',
        positionX: 12,
        positionY: 24,
        height: 222,
        scale: 1.6,
      },
    };

    const { result } = renderHook(() => useNoteCoverController('a.md'));

    expect(result.current.cover).toEqual({
      url: 'covers/a.png',
      positionX: 12,
      positionY: 24,
      height: 222,
      scale: 1.6,
    });
    expect(result.current.vaultPath).toBe('/vault');

    act(() => {
      result.current.updateCover('covers/next.png', 30, 40, 260, 1.2);
    });

    expect(hoisted.setNoteCover).toHaveBeenCalledWith('a.md', {
      assetPath: 'covers/next.png',
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

  it('adds random cover from assets and opens picker', () => {
    hoisted.getAssetList.mockReturnValue([{ filename: 'covers/library.png' }]);
    const { result } = renderHook(() => useNoteCoverController('random.md'));

    act(() => {
      result.current.addRandomCoverAndOpenPicker();
    });

    expect(hoisted.setNoteCover).toHaveBeenCalledWith('random.md', {
      assetPath: 'covers/library.png',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });
    expect(result.current.isPickerOpen).toBe(true);
    expect(hoisted.getRandomBuiltinCover).not.toHaveBeenCalled();
  });

  it('falls back to builtin random cover when library is empty', () => {
    hoisted.getAssetList.mockReturnValue([]);
    const { result } = renderHook(() => useNoteCoverController('builtin.md'));

    act(() => {
      result.current.addRandomCoverAndOpenPicker();
    });

    expect(hoisted.getRandomBuiltinCover).toHaveBeenCalledTimes(1);
    expect(hoisted.setNoteCover).toHaveBeenCalledWith('builtin.md', {
      assetPath: 'builtin:covers/default',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });
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
});
