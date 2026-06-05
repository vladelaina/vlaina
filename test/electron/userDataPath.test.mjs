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

  it('links an isolated development profile to shared app data when both env paths are provided', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const sharedUserData = path.join(tempRoot, 'shared-user-data');
    const sharedAppData = path.join(sharedUserData, '.vlaina');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await writeJson(path.join(sharedAppData, 'chat', 'sessions.json'), {
      sessions: [{ id: 'shared-session' }],
    });
    await writeFile(path.join(sharedUserData, 'Preferences'), '{"theme":"dark"}\n', 'utf8');
    await writeFile(path.join(sharedUserData, 'SingletonLock'), 'locked\n', 'utf8');

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      env: {
        VLAINA_USER_DATA_DIR: isolatedUserData,
        VLAINA_SHARED_USER_DATA_DIR: sharedUserData,
        VLAINA_SHARED_APP_DATA_DIR: sharedAppData,
      },
    });

    const linkedAppData = path.join(isolatedUserData, '.vlaina');
    expect(result).toEqual({
      changed: true,
      userDataPath: isolatedUserData,
      seeded: false,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', isolatedUserData);
    expect(fs.lstatSync(linkedAppData).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(linkedAppData)).toBe(fs.realpathSync(sharedAppData));
    await expect(readFile(path.join(linkedAppData, 'chat', 'sessions.json'), 'utf8'))
      .resolves.toContain('shared-session');
    await expect(readFile(path.join(isolatedUserData, 'Preferences'), 'utf8'))
      .resolves.toContain('dark');
    expect(fs.existsSync(path.join(isolatedUserData, 'SingletonLock'))).toBe(false);
  });

  it('refuses to replace an existing isolated .vlaina directory with the shared app data link', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const sharedAppData = path.join(tempRoot, 'shared-user-data', '.vlaina');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await writeJson(path.join(isolatedUserData, '.vlaina', 'chat', 'sessions.json'), {
      sessions: [{ id: 'wrong-isolated-session' }],
    });
    await writeJson(path.join(sharedAppData, 'chat', 'sessions.json'), {
      sessions: [{ id: 'shared-session' }],
    });

    expect(() => configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      env: {
        VLAINA_USER_DATA_DIR: isolatedUserData,
        VLAINA_SHARED_APP_DATA_DIR: sharedAppData,
      },
    })).toThrow('Refusing to replace existing development app data');

    const linkedAppData = path.join(isolatedUserData, '.vlaina');
    expect(fs.lstatSync(linkedAppData).isDirectory()).toBe(true);
    await expect(readFile(path.join(linkedAppData, 'chat', 'sessions.json'), 'utf8'))
      .resolves.toContain('wrong-isolated-session');
    await expect(readFile(path.join(linkedAppData, 'chat', 'sessions.json'), 'utf8'))
      .resolves.not.toContain('shared-session');
    const backupDirs = (await readdir(isolatedUserData))
      .filter((name) => name.startsWith('.vlaina-pre-seed-backup-'));
    expect(backupDirs).toHaveLength(0);
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

  it('uses the main repository development profile for linked worktrees', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const mainRepo = path.join(tempRoot, 'repo');
    const linkedWorktree = path.join(tempRoot, 'worktrees', 'feature');
    const worktreeGitDir = path.join(mainRepo, '.git', 'worktrees', 'feature');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await fs.promises.mkdir(worktreeGitDir, { recursive: true });
    await fs.promises.mkdir(linkedWorktree, { recursive: true });
    await writeFile(
      path.join(linkedWorktree, '.git'),
      `gitdir: ${worktreeGitDir}\n`,
      'utf8'
    );

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: linkedWorktree,
      env: {},
    });

    const targetUserData = path.join(mainRepo, 'temp', 'electron-user-data');
    expect(result).toEqual({
      changed: true,
      userDataPath: targetUserData,
      seeded: false,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', targetUserData);
  });

  it('seeds the shared worktree profile from the legacy per-worktree profile', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const mainRepo = path.join(tempRoot, 'repo');
    const linkedWorktree = path.join(tempRoot, 'worktrees', 'feature');
    const worktreeGitDir = path.join(mainRepo, '.git', 'worktrees', 'feature');
    const legacyUserData = path.join(linkedWorktree, 'temp', 'electron-user-data');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await fs.promises.mkdir(worktreeGitDir, { recursive: true });
    await fs.promises.mkdir(linkedWorktree, { recursive: true });
    await writeFile(
      path.join(linkedWorktree, '.git'),
      `gitdir: ${worktreeGitDir}\n`,
      'utf8'
    );
    await writeJson(path.join(defaultUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [{ id: 'default-starred', kind: 'note' }],
    });
    await writeJson(path.join(legacyUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [{ id: 'legacy-starred', kind: 'note' }],
    });

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: linkedWorktree,
      env: {},
    });

    const targetUserData = path.join(mainRepo, 'temp', 'electron-user-data');
    expect(result.seeded).toBe(true);
    expect(app.setPath).toHaveBeenCalledWith('userData', targetUserData);
    await expect(readFile(path.join(targetUserData, '.vlaina', 'store', 'notes-starred.json'), 'utf8'))
      .resolves.toContain('legacy-starred');
    await expect(readFile(path.join(targetUserData, '.vlaina', 'store', 'notes-starred.json'), 'utf8'))
      .resolves.not.toContain('default-starred');
  });

  it('merges legacy per-worktree starred entries into an existing shared profile', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const mainRepo = path.join(tempRoot, 'repo');
    const linkedWorktree = path.join(tempRoot, 'worktrees', 'feature');
    const worktreeGitDir = path.join(mainRepo, '.git', 'worktrees', 'feature');
    const legacyUserData = path.join(linkedWorktree, 'temp', 'electron-user-data');
    const sharedUserData = path.join(mainRepo, 'temp', 'electron-user-data');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await fs.promises.mkdir(worktreeGitDir, { recursive: true });
    await fs.promises.mkdir(linkedWorktree, { recursive: true });
    await writeFile(
      path.join(linkedWorktree, '.git'),
      `gitdir: ${worktreeGitDir}\n`,
      'utf8'
    );
    await writeJson(path.join(sharedUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [
        {
          id: 'shared-starred',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'shared.md',
        },
      ],
    });
    await writeJson(path.join(legacyUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [
        {
          id: 'legacy-starred',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'legacy.md',
        },
        {
          id: 'shared-duplicate',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'shared.md',
        },
      ],
    });

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: linkedWorktree,
      env: {},
    });

    const merged = JSON.parse(
      await readFile(path.join(sharedUserData, '.vlaina', 'store', 'notes-starred.json'), 'utf8')
    );
    expect(result.seeded).toBe(false);
    expect(merged.entries.map((entry) => entry.id)).toEqual([
      'shared-starred',
      'legacy-starred',
    ]);
  });

  it('ignores oversized legacy starred registries during shared profile merge', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const mainRepo = path.join(tempRoot, 'repo');
    const linkedWorktree = path.join(tempRoot, 'worktrees', 'feature');
    const worktreeGitDir = path.join(mainRepo, '.git', 'worktrees', 'feature');
    const legacyUserData = path.join(linkedWorktree, 'temp', 'electron-user-data');
    const sharedUserData = path.join(mainRepo, 'temp', 'electron-user-data');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await fs.promises.mkdir(worktreeGitDir, { recursive: true });
    await fs.promises.mkdir(linkedWorktree, { recursive: true });
    await writeFile(
      path.join(linkedWorktree, '.git'),
      `gitdir: ${worktreeGitDir}\n`,
      'utf8'
    );
    await writeJson(path.join(sharedUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [{ id: 'shared-starred', kind: 'note' }],
    });
    await writeJson(path.join(legacyUserData, '.vlaina', 'store', 'notes-starred.json'), {
      version: 1,
      entries: [{ id: 'legacy-starred', kind: 'note' }],
      padding: 'x'.repeat(5 * 1024 * 1024),
    });

    configureDevelopmentUserDataPath({
      app,
      repoRoot: linkedWorktree,
      env: {},
    });

    const merged = JSON.parse(
      await readFile(path.join(sharedUserData, '.vlaina', 'store', 'notes-starred.json'), 'utf8')
    );
    expect(merged.entries.map((entry) => entry.id)).toEqual(['shared-starred']);
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
