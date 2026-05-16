import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCurrentNoteExternalSync } from './notesExternalCurrentNoteSync';

const hoisted = vi.hoisted(() => ({
  notesState: {
    currentNote: { path: 'docs/alpha.md', content: '# alpha' } as { path: string; content: string } | null,
  },
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: {
    getState: () => hoisted.notesState,
  },
}));

describe('createCurrentNoteExternalSync', () => {
  beforeEach(() => {
    hoisted.notesState.currentNote = { path: 'docs/alpha.md', content: '# alpha' };
  });

  it('queues a follow-up sync when a reconcile request arrives during an active sync', async () => {
    const readResolvers: Array<() => void> = [];
    const syncCurrentNoteFromDisk = vi.fn(() => new Promise<'unchanged'>((resolve) => {
      readResolvers.push(() => resolve('unchanged'));
    }));
    const applyExternalPathDeletion = vi.fn();
    const { reconcileCurrentNote } = createCurrentNoteExternalSync({
      syncCurrentNoteFromDisk,
      applyExternalPathDeletion,
    });

    const firstReconcile = reconcileCurrentNote();
    const secondReconcile = reconcileCurrentNote({ force: true });

    expect(syncCurrentNoteFromDisk).toHaveBeenCalledTimes(1);
    expect(syncCurrentNoteFromDisk).toHaveBeenNthCalledWith(1, undefined);

    readResolvers[0]?.();
    await Promise.resolve();

    expect(syncCurrentNoteFromDisk).toHaveBeenCalledTimes(2);
    expect(syncCurrentNoteFromDisk).toHaveBeenNthCalledWith(2, { force: true });

    readResolvers[1]?.();
    await firstReconcile;
    await secondReconcile;
  });
});
