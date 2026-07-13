import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeFileAtomicallyIfUnchanged } from '../../electron/desktopAtomicFile.mjs';

const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((tempPath) =>
    rm(tempPath, { recursive: true, force: true })
  ));
});

async function createTempDir() {
  const tempPath = await mkdtemp(path.join(tmpdir(), 'vlaina-atomic-note-'));
  tempPaths.push(tempPath);
  return tempPath;
}

describe('writeFileAtomicallyIfUnchanged', () => {
  it('allows only one concurrent writer for the same baseline', async () => {
    const tempPath = await createTempDir();
    const notePath = path.join(tempPath, 'alpha.md');
    await writeFile(notePath, 'ab');

    const results = await Promise.all([
      writeFileAtomicallyIfUnchanged(notePath, 'ab', 'abcd啦啦啦'),
      writeFileAtomicallyIfUnchanged(notePath, 'ab', 'ab窗口二'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(['abcd啦啦啦', 'ab窗口二']).toContain(await readFile(notePath, 'utf8'));
  });

  it('shares a lock with symlink aliases and preserves the symlink', async () => {
    const tempPath = await createTempDir();
    const targetPath = path.join(tempPath, 'target.md');
    const aliasPath = path.join(tempPath, 'alias.md');
    await writeFile(targetPath, 'ab');
    await symlink(targetPath, aliasPath);

    const results = await Promise.all([
      writeFileAtomicallyIfUnchanged(targetPath, 'ab', 'abcd啦啦啦'),
      writeFileAtomicallyIfUnchanged(aliasPath, 'ab', 'ab别名窗口'),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await readFile(aliasPath, 'utf8')).toBe(await readFile(targetPath, 'utf8'));
    expect((await lstat(aliasPath)).isSymbolicLink()).toBe(true);
  });
});
