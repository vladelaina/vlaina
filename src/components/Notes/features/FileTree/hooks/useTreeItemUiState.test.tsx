import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTreeItemUiState } from './useTreeItemUiState';

const addToast = vi.fn();

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof addToast }) => unknown) => selector({ addToast }),
}));

describe('useTreeItemUiState', () => {
  beforeEach(() => {
    addToast.mockReset();
  });

  it('rejects unsupported file name characters while renaming', () => {
    const { result } = renderHook(() => useTreeItemUiState({ path: 'alpha.md', name: 'alpha.md' }));

    act(() => {
      result.current.setRenameValue('valid.md');
    });
    expect(result.current.renameValue).toBe('valid.md');

    act(() => {
      result.current.setRenameValue('bad/name.md');
    });
    expect(result.current.renameValue).toBe('valid.md');
    expect(addToast).toHaveBeenCalledWith('File name contains unsupported characters.', 'error', 3500);
  });
});
