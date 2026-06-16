import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTreeItemPathActions } from './useTreeItemPathActions';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  copyTreeItemPath: vi.fn(),
  openTreeItemLocation: vi.fn(),
  openTreeItemInNewWindow: vi.fn(),
}));

vi.mock('@/stores/useToastStore', () => ({
  useToastStore: (selector: (state: { addToast: typeof mocks.addToast }) => unknown) =>
    selector({ addToast: mocks.addToast }),
}));

vi.mock('../pathActions', () => ({
  copyTreeItemPath: mocks.copyTreeItemPath,
  openTreeItemLocation: mocks.openTreeItemLocation,
  openTreeItemInNewWindow: mocks.openTreeItemInNewWindow,
}));

describe('useTreeItemPathActions', () => {
  beforeEach(() => {
    mocks.addToast.mockReset();
    mocks.copyTreeItemPath.mockReset();
    mocks.openTreeItemLocation.mockReset();
    mocks.openTreeItemInNewWindow.mockReset();
  });

  it('silences transient missing notes path errors', async () => {
    const unavailable = new Error('Notes path is not available');
    mocks.copyTreeItemPath.mockRejectedValueOnce(unavailable);
    mocks.openTreeItemLocation.mockRejectedValueOnce(unavailable);
    mocks.openTreeItemInNewWindow.mockRejectedValueOnce(unavailable);

    const { result } = renderHook(() =>
      useTreeItemPathActions({
        notesPath: '',
        itemPath: 'docs/readme.md',
      }),
    );

    await act(async () => {
      await result.current.handleCopyPath();
      await result.current.handleOpenLocation();
      await result.current.handleOpenInNewWindow('file');
    });

    expect(mocks.openTreeItemLocation).toHaveBeenCalledWith('', 'docs/readme.md', 'file');
    expect(mocks.addToast).not.toHaveBeenCalled();
  });

  it('passes folder location requests through to the path action', async () => {
    const { result } = renderHook(() =>
      useTreeItemPathActions({
        notesPath: '/vault',
        itemPath: 'docs',
      }),
    );

    await act(async () => {
      await result.current.handleOpenLocation('folder');
    });

    expect(mocks.openTreeItemLocation).toHaveBeenCalledWith('/vault', 'docs', 'folder');
  });

  it('still reports real path action failures', async () => {
    mocks.copyTreeItemPath.mockRejectedValueOnce(new Error('Path must stay inside the current vault.'));

    const { result } = renderHook(() =>
      useTreeItemPathActions({
        notesPath: '/vault',
        itemPath: '../secret.md',
      }),
    );

    await act(async () => {
      await result.current.handleCopyPath();
    });

    expect(mocks.addToast).toHaveBeenCalledWith('Path must stay inside the current vault.', 'error');
  });
});
