import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalImage } from './useLocalImage';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
}));

vi.mock('@/lib/storage/adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/storage/adapter')>()),
  getStorageAdapter: () => ({
    exists: hoisted.exists,
  }),
}));

describe('useLocalImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not try to resolve relative paths while the vault path is temporarily empty', async () => {
    const { result } = renderHook(() =>
      useLocalImage('assets/2026-03-31_16-08-49.png', '', undefined)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('assets/2026-03-31_16-08-49.png');
    expect(result.current.error).toBeNull();
    expect(hoisted.loadImageAsBlob).not.toHaveBeenCalled();
  });

  it('falls back to the vault-root image path when the note-relative path is missing', async () => {
    hoisted.exists
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    hoisted.loadImageAsBlob.mockResolvedValueOnce('blob:vault-root-image');

    const { result } = renderHook(() =>
      useLocalImage('assets/demo.png', '/vault', 'daily/demo.md')
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.resolvedSrc).toBe('blob:vault-root-image');
    expect(result.current.error).toBeNull();
    expect(hoisted.exists).toHaveBeenNthCalledWith(1, '/vault/daily/assets/demo.png');
    expect(hoisted.exists).toHaveBeenNthCalledWith(2, '/vault/assets/demo.png');
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledTimes(1);
    expect(hoisted.loadImageAsBlob).toHaveBeenCalledWith('/vault/assets/demo.png');
  });
});
