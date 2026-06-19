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
  assertAuthorizedFsRenameTarget,
  authorizeFsPath,
  resetAuthorizedFsPathsForTests,
} from '../../electron/fsAccess.mjs';

describe('desktop filesystem symlink boundary', () => {
  let tempDir = '';
  let previousUserDataOverride: string | undefined;

  beforeEach(async () => {
    previousUserDataOverride = process.env.VLAINA_USER_DATA_DIR;
    delete process.env.VLAINA_USER_DATA_DIR;
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'vlaina-fs-access-'));
    hoisted.userDataPath = path.join(tempDir, 'user-data');
    await mkdir(hoisted.userDataPath, { recursive: true });
    resetAuthorizedFsPathsForTests();
  });

  afterEach(async () => {
    if (previousUserDataOverride === undefined) {
      delete process.env.VLAINA_USER_DATA_DIR;
    } else {
      process.env.VLAINA_USER_DATA_DIR = previousUserDataOverride;
    }
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

  it('rejects rename targets that resolve outside authorized filesystem roots', async () => {
    const authorizedRoot = path.join(tempDir, 'authorized');
    const outsideRoot = path.join(tempDir, 'outside');
    await mkdir(authorizedRoot, { recursive: true });
    await mkdir(outsideRoot, { recursive: true });
    await writeFile(path.join(authorizedRoot, 'note.md'), '# note', 'utf8');
    await symlink(outsideRoot, path.join(authorizedRoot, 'linked-outside'), 'dir');

    await authorizeFsPath(authorizedRoot, 'root');

    await expect(assertAuthorizedFsRenameTarget(
      path.join(authorizedRoot, 'note.md'),
      path.join(authorizedRoot, 'linked-outside', 'moved.md'),
    )).rejects.toThrow('File path is not authorized for desktop access');
  });

  it('keeps rename targets inside an authorized root writable when their parent is real', async () => {
    const authorizedRoot = path.join(tempDir, 'authorized');
    await mkdir(authorizedRoot, { recursive: true });
    await writeFile(path.join(authorizedRoot, 'note.md'), '# note', 'utf8');

    await authorizeFsPath(authorizedRoot, 'root');

    await expect(assertAuthorizedFsRenameTarget(
      path.join(authorizedRoot, 'note.md'),
      path.join(authorizedRoot, 'renamed.md'),
    )).resolves.toBe(path.join(authorizedRoot, 'renamed.md'));
  });

  it('loads saved symlink roots with their real filesystem access key', async () => {
    const realRoot = path.join(tempDir, 'real-vault');
    const linkedRoot = path.join(tempDir, 'linked-vault');
    await mkdir(realRoot, { recursive: true });
    await symlink(realRoot, linkedRoot, 'dir');
    await writeFile(path.join(realRoot, 'note.md'), '# note', 'utf8');
    const permissionsDir = path.join(hoisted.userDataPath, '.vlaina', 'app', 'permissions');
    await mkdir(permissionsDir, { recursive: true });
    await writeFile(
      path.join(permissionsDir, 'filesystem.json'),
      JSON.stringify({ roots: [linkedRoot], files: [], watchRoots: [] }),
      'utf8',
    );

    await expect(assertAuthorizedFsPath(path.join(linkedRoot, 'note.md'))).resolves.toBe(
      path.join(linkedRoot, 'note.md'),
    );
  });

  it('authorizes an explicit development userData override root', async () => {
    const isolatedUserDataPath = path.join(tempDir, 'isolated-user-data');
    process.env.VLAINA_USER_DATA_DIR = isolatedUserDataPath;
    await mkdir(isolatedUserDataPath, { recursive: true });

    await expect(
      assertAuthorizedFsPath(path.join(isolatedUserDataPath, '.vlaina', 'notes', 'state.json')),
    ).resolves.toBe(path.join(isolatedUserDataPath, '.vlaina', 'notes', 'state.json'));
  });

  it('keeps sensitive files protected inside an explicit development userData override', async () => {
    const isolatedUserDataPath = path.join(tempDir, 'isolated-user-data');
    process.env.VLAINA_USER_DATA_DIR = isolatedUserDataPath;
    await mkdir(isolatedUserDataPath, { recursive: true });

    await expect(
      assertAuthorizedFsPath(path.join(isolatedUserDataPath, '.vlaina', 'app', 'secrets', 'account.json')),
    ).rejects.toThrow('File path is reserved for internal desktop storage');
  });
});
