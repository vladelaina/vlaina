import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tempRoot;

describe('Electron atomic file writes', () => {
  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'vlaina-atomic-write-test-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('fully replaces existing important files on successful writes', async () => {
    const { writeFileAtomically } = await import('../../electron/desktopIpc.mjs');
    const filePath = path.join(tempRoot, 'notes-starred.json');
    await writeFile(filePath, 'old-content', 'utf8');

    await writeFileAtomically(filePath, 'new-complete-content');

    await expect(readFile(filePath, 'utf8')).resolves.toBe('new-complete-content');
    const leftovers = (await readdir(tempRoot))
      .filter((name) => name.includes('.tmp-'));
    expect(leftovers).toHaveLength(0);
  });

  it('preserves the existing file if the temporary write fails before rename', async () => {
    const { writeFileAtomically } = await import('../../electron/desktopIpc.mjs');
    const filePath = path.join(tempRoot, 'sessions.json');
    await writeFile(filePath, 'old-complete-content', 'utf8');

    const openFile = async (targetPath) => ({
      writeFile: async () => {
        await writeFile(targetPath, 'partial-new-content', 'utf8');
        throw new Error('simulated disk failure');
      },
      sync: async () => {},
      close: async () => {},
    });

    await expect(writeFileAtomically(filePath, 'new-complete-content', { openFile }))
      .rejects.toThrow('simulated disk failure');
    await expect(readFile(filePath, 'utf8')).resolves.toBe('old-complete-content');
    const leftovers = (await readdir(tempRoot))
      .filter((name) => name.includes('.tmp-'));
    expect(leftovers).toHaveLength(0);
  });
});
