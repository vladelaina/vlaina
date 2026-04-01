import { describe, expect, it } from 'vitest';
import {
  getAbsoluteRenameWatchPaths,
  getRelativeRenameWatchPaths,
  isCreateWatchEvent,
  isRemoveWatchEvent,
} from './notesExternalSyncUtils';

describe('notesExternalSyncUtils', () => {
  it('parses absolute rename paths from a paired rename event', () => {
    const renamePaths = getAbsoluteRenameWatchPaths({
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\vault\\docs', 'C:\\vault\\archive'],
    });

    expect(renamePaths).toEqual({
      oldPath: 'C:/vault/docs',
      newPath: 'C:/vault/archive',
    });
  });

  it('converts rename paths to vault-relative paths', () => {
    const renamePaths = getRelativeRenameWatchPaths('C:\\vault', {
      type: { modify: { kind: 'rename', mode: 'both' } },
      paths: ['C:\\vault\\docs', 'C:\\vault\\archive'],
    });

    expect(renamePaths).toEqual({
      oldPath: 'docs',
      newPath: 'archive',
    });
  });

  it('detects create and remove watch events', () => {
    expect(isCreateWatchEvent({ type: { create: { kind: 'folder' } } })).toBe(true);
    expect(isRemoveWatchEvent({ type: { remove: { kind: 'folder' } } })).toBe(true);
    expect(isCreateWatchEvent({ type: { remove: { kind: 'folder' } } })).toBe(false);
    expect(isRemoveWatchEvent({ type: { create: { kind: 'folder' } } })).toBe(false);
  });
});
