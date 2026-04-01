import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalImage } from './useLocalImage';

const hoisted = vi.hoisted(() => ({
  loadImageAsBlob: vi.fn(),
}));

vi.mock('@/lib/assets/io/reader', () => ({
  loadImageAsBlob: hoisted.loadImageAsBlob,
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
});
