import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureDevelopmentUserDataPath,
  seedDevelopmentAppData,
} from '../../electron/userDataPath.mjs';

let tempRoot;

function createApp({ isPackaged, userDataPath }) {
  return {
    isPackaged,
    getPath: vi.fn((name) => {
      if (name !== 'userData') {
        throw new Error(`Unexpected path request: ${name}`);
      }
      return userDataPath;
    }),
    setPath: vi.fn(),
  };
}

async function writeJson(filePath, value) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

describe('Electron userData path safety', () => {
  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'vlaina-user-data-test-'));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('never changes packaged app userData, even when a dev override env var is present', () => {
    const packagedUserData = path.join(tempRoot, 'packaged-user-data');
    const overrideUserData = path.join(tempRoot, 'override-user-data');
    const app = createApp({ isPackaged: true, userDataPath: packagedUserData });

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      env: { VLAINA_USER_DATA_DIR: overrideUserData },
    });

    expect(result).toEqual({
      changed: false,
      userDataPath: packagedUserData,
      seeded: false,
    });
    expect(app.setPath).not.toHaveBeenCalled();
    expect(fs.existsSync(overrideUserData)).toBe(false);
  });

  it('seeds a new development profile from the existing default app data', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const repoRoot = path.join(tempRoot, 'worktree');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await writeJson(path.join(defaultUserData, '.vlaina', 'chat', 'sessions.json'), {
      sessions: [{ id: 'session-important' }],
    });
    await writeJson(path.join(defaultUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [{ id: 'starred-important', kind: 'note' }],
    });

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot,
      env: {},
    });

    const targetUserData = path.join(repoRoot, 'temp', 'electron-user-data');
    expect(result).toEqual({
      changed: true,
      userDataPath: targetUserData,
      seeded: true,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', targetUserData);
    await expect(readFile(path.join(targetUserData, '.vlaina', 'chat', 'sessions.json'), 'utf8'))
      .resolves.toContain('session-important');
    await expect(readFile(path.join(targetUserData, '.vlaina', 'store', 'notes-starred.json'), 'utf8'))
      .resolves.toContain('starred-important');
    await expect(readFile(path.join(targetUserData, '.vlaina-dev-profile-seeded'), 'utf8'))
      .resolves.toContain(path.join(defaultUserData, '.vlaina'));
  });

  it('backs up existing development app data before seeding from the default profile', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const targetUserData = path.join(tempRoot, 'target-user-data');

    await writeJson(path.join(defaultUserData, '.vlaina', 'chat', 'sessions.json'), {
      sessions: [{ id: 'source-session' }],
    });
    await writeJson(path.join(targetUserData, '.vlaina', 'chat', 'sessions.json'), {
      sessions: [{ id: 'target-session' }],
    });

    expect(seedDevelopmentAppData(defaultUserData, targetUserData)).toBe(true);

    await expect(readFile(path.join(targetUserData, '.vlaina', 'chat', 'sessions.json'), 'utf8'))
      .resolves.toContain('source-session');

    const backupDir = (await readdir(targetUserData))
      .find((name) => name.startsWith('.vlaina-pre-seed-backup-'));
    expect(backupDir).toBeTruthy();
    await expect(readFile(path.join(targetUserData, backupDir, 'chat', 'sessions.json'), 'utf8'))
      .resolves.toContain('target-session');
  });

  it('does not reseed or overwrite a development profile after the seed marker exists', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const targetUserData = path.join(tempRoot, 'target-user-data');

    await writeJson(path.join(defaultUserData, '.vlaina', 'chat', 'sessions.json'), {
      sessions: [{ id: 'source-session' }],
    });
    await writeJson(path.join(targetUserData, '.vlaina', 'chat', 'sessions.json'), {
      sessions: [{ id: 'target-session' }],
    });
    await writeFile(path.join(targetUserData, '.vlaina-dev-profile-seeded'), 'already seeded\n', 'utf8');

    expect(seedDevelopmentAppData(defaultUserData, targetUserData)).toBe(false);

    await expect(readFile(path.join(targetUserData, '.vlaina', 'chat', 'sessions.json'), 'utf8'))
      .resolves.toContain('target-session');
    const backupDirs = (await readdir(targetUserData))
      .filter((name) => name.startsWith('.vlaina-pre-seed-backup-'));
    expect(backupDirs).toHaveLength(0);
  });
});
