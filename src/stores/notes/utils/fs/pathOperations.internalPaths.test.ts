import { describe, expect, it, vi } from 'vitest';
import {
  resolveUniqueMovedPath,
  resolveUniquePath,
  resolveUniqueRenamedPath,
} from './pathOperations';

const hoisted = vi.hoisted(() => ({
  exists: vi.fn(async () => false),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    exists: hoisted.exists,
  }),
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

describe('pathOperations internal paths', () => {
  it('keeps user dot folders valid for note creation targets', async () => {
    await expect(resolveUniquePath('/notesRoot', '.notes', 'alpha', false)).resolves.toEqual({
      relativePath: '.notes/alpha.md',
      fullPath: '/notesRoot/.notes/alpha.md',
      fileName: 'alpha.md',
    });
  });

  it('rejects note creation targets inside internal folders', async () => {
    await expect(resolveUniquePath('/notesRoot', '.vlaina', 'workspace', false)).rejects.toThrow(
      'Target folder must not be inside an internal notes folder.',
    );
    await expect(resolveUniquePath('/notesRoot', 'docs/.git', 'config', false)).rejects.toThrow(
      'Target folder must not be inside an internal notes folder.',
    );
    await expect(resolveUniquePath('/notesRoot', '.VLAINA', 'workspace', false)).rejects.toThrow(
      'Target folder must not be inside an internal notes folder.',
    );
    await expect(resolveUniquePath('/notesRoot', 'docs/.GIT', 'config', false)).rejects.toThrow(
      'Target folder must not be inside an internal notes folder.',
    );
  });

  it('rejects renames that start inside internal folders', async () => {
    await expect(resolveUniqueRenamedPath('/notesRoot', 'docs/.git/config.md', 'config', false))
      .rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(resolveUniqueRenamedPath('/notesRoot', 'docs/.GIT/config.md', 'config', false))
      .rejects.toThrow('Path must not be inside an internal notes folder.');
  });

  it('rejects moves from or into internal folders', async () => {
    await expect(resolveUniqueMovedPath('/notesRoot', '.vlaina/workspace.md', 'docs', false))
      .rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(resolveUniqueMovedPath('/notesRoot', 'docs/alpha.md', '.git', false))
      .rejects.toThrow('Target folder must not be inside an internal notes folder.');
    await expect(resolveUniqueMovedPath('/notesRoot', '.VLAINA/workspace.md', 'docs', false))
      .rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(resolveUniqueMovedPath('/notesRoot', 'docs/alpha.md', '.GIT', false))
      .rejects.toThrow('Target folder must not be inside an internal notes folder.');
  });
});
