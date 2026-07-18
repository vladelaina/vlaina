import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveWorkspaceState: vi.fn(async (): Promise<void> => undefined),
}));

vi.mock('./storage', () => ({
  saveWorkspaceState: mocks.saveWorkspaceState,
}));

import {
  persistWorkspaceSnapshot,
  saveWorkspaceSnapshot,
  WORKSPACE_SNAPSHOT_PERSIST_DELAY_MS,
} from './workspacePersistence';

const snapshot = (currentNotePath: string) => ({
  rootFolder: null,
  currentNotePath,
  fileTreeSortMode: 'name-asc' as const,
  expandedFolders: [],
});

describe('workspace snapshot persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.saveWorkspaceState.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces repeated snapshots for one notes root', async () => {
    persistWorkspaceSnapshot('/notesRoot', snapshot('alpha.md'));
    persistWorkspaceSnapshot('/notesRoot', snapshot('beta.md'));

    await vi.advanceTimersByTimeAsync(WORKSPACE_SNAPSHOT_PERSIST_DELAY_MS - 1);
    expect(mocks.saveWorkspaceState).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.saveWorkspaceState).toHaveBeenCalledTimes(1);
    expect(mocks.saveWorkspaceState).toHaveBeenCalledWith('/notesRoot', expect.objectContaining({
      currentNotePath: 'beta.md',
    }));
  });

  it('cancels a queued snapshot before an immediate save', async () => {
    persistWorkspaceSnapshot('/notesRoot', snapshot('stale.md'));
    await saveWorkspaceSnapshot('/notesRoot', snapshot('current.md'));
    await vi.advanceTimersByTimeAsync(WORKSPACE_SNAPSHOT_PERSIST_DELAY_MS);

    expect(mocks.saveWorkspaceState).toHaveBeenCalledTimes(1);
    expect(mocks.saveWorkspaceState).toHaveBeenCalledWith('/notesRoot', expect.objectContaining({
      currentNotePath: 'current.md',
    }));
  });

  it('serializes an immediate save after an in-flight debounced save', async () => {
    let finishStaleSave: (() => void) | undefined;
    mocks.saveWorkspaceState.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishStaleSave = resolve;
    }));

    persistWorkspaceSnapshot('/notesRoot', snapshot('stale.md'));
    await vi.advanceTimersByTimeAsync(WORKSPACE_SNAPSHOT_PERSIST_DELAY_MS);

    const currentSave = saveWorkspaceSnapshot('/notesRoot', snapshot('current.md'));
    expect(mocks.saveWorkspaceState).toHaveBeenCalledTimes(1);

    finishStaleSave?.();
    await currentSave;

    expect(mocks.saveWorkspaceState).toHaveBeenCalledTimes(2);
    expect(mocks.saveWorkspaceState).toHaveBeenLastCalledWith('/notesRoot', expect.objectContaining({
      currentNotePath: 'current.md',
    }));
  });
});
