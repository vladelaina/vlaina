import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  userDataPath: '',
}));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath: vi.fn(() => hoisted.userDataPath),
    },
  },
}));

import {
  assertAuthorizedFsPath,
  authorizeFsPath,
  resetAuthorizedFsPathsForTests,
} from '../../electron/fsAccess.mjs';

describe('desktop filesystem symlink boundary', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'vlaina-fs-access-'));
    hoisted.userDataPath = path.join(tempDir, 'user-data');
    await mkdir(hoisted.userDataPath, { recursive: true });
    resetAuthorizedFsPathsForTests();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('rejects authorized-root symlinks that resolve outside authorized filesystem roots', async () => {
    const authorizedRoot = path.join(tempDir, 'authorized');
    const outsideRoot = path.join(tempDir, 'outside');
    await mkdir(authorizedRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(path.join(outsideRoot, 'secret.md'), 'secret', 'utf8');
    await symlink(outsideRoot, path.join(authorizedRoot, 'linked-outside'), 'dir');

    await authorizeFsPath(authorizedRoot, 'root');

    await expect(assertAuthorizedFsPath(path.join(authorizedRoot, 'linked-outside', 'secret.md'))).rejects.toThrow(
      'File path is not authorized for desktop access',
    );
  });

  it('keeps new files inside an authorized root writable when their parent is real', async () => {
    const authorizedRoot = path.join(tempDir, 'authorized');
    await mkdir(authorizedRoot, { recursive: true });

    await authorizeFsPath(authorizedRoot, 'root');

    await expect(assertAuthorizedFsPath(path.join(authorizedRoot, 'new-note.md'))).resolves.toBe(
      path.join(authorizedRoot, 'new-note.md'),
    );
  });

  it('loads saved symlink roots with their real filesystem access key', async () => {
    const realRoot = path.join(tempDir, 'real-vault');
    const linkedRoot = path.join(tempDir, 'linked-vault');
    await mkdir(realRoot, { recursive: true });
    await symlink(realRoot, linkedRoot, 'dir');
    await writeFile(path.join(realRoot, 'note.md'), '# note', 'utf8');
    const storeDir = path.join(hoisted.userDataPath, '.vlaina', 'store');
    await mkdir(storeDir, { recursive: true });
    await writeFile(
      path.join(storeDir, 'authorized-fs-paths.json'),
      JSON.stringify({ roots: [linkedRoot], files: [], watchRoots: [] }),
      'utf8',
    );

    await expect(assertAuthorizedFsPath(path.join(linkedRoot, 'note.md'))).resolves.toBe(
      path.join(linkedRoot, 'note.md'),
    );
  });
});
