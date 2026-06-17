import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureDevelopmentUserDataPath } from '../../electron/userDataPath.mjs';

let tempRoot;

function createApp({
  isPackaged,
  userDataPath,
  appDataPath = path.join(path.dirname(userDataPath), 'app-data'),
  name = 'vlaina',
}) {
  return {
    isPackaged,
    getPath: vi.fn((name) => {
      if (name === 'userData') {
        return userDataPath;
      }
      if (name === 'appData') {
        return appDataPath;
      }
      throw new Error(`Unexpected path request: ${name}`);
    }),
    getName: vi.fn(() => name),
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

  it('does not apply development userData overrides to a safe packaged app userData path', () => {
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
    });
    expect(app.setPath).not.toHaveBeenCalled();
    expect(fs.existsSync(overrideUserData)).toBe(false);
  });

  it('moves packaged userData away from the Windows install directory without migrating misplaced config', async () => {
    const installDir = path.join(tempRoot, 'AppData', 'Local', 'Programs', 'vlaina');
    const packagedUserData = installDir;
    const roamingAppData = path.join(tempRoot, 'AppData', 'Roaming');
    const expectedUserData = path.join(roamingAppData, 'vlaina');
    const app = createApp({
      isPackaged: true,
      userDataPath: packagedUserData,
      appDataPath: roamingAppData,
    });

    await writeJson(path.join(packagedUserData, '.vlaina', 'app', 'settings.json'), {
      version: 1,
      data: { settings: { language: 'zh-CN' } },
    });
    await writeFile(path.join(packagedUserData, 'Preferences'), '{"theme":"dark"}\n', 'utf8');
    await fs.promises.mkdir(path.join(packagedUserData, 'Local Storage', 'leveldb'), { recursive: true });
    await writeFile(
      path.join(packagedUserData, 'Local Storage', 'leveldb', '000003.log'),
      'local-storage-state\n',
      'utf8'
    );
    await fs.promises.mkdir(path.join(packagedUserData, 'Cache'), { recursive: true });
    await writeFile(path.join(packagedUserData, 'Cache', 'cache.bin'), 'cache\n', 'utf8');
    await writeFile(path.join(packagedUserData, 'SingletonLock'), 'lock\n', 'utf8');

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      runtime: {
        execPath: path.join(installDir, 'vlaina.exe'),
        resourcesPath: path.join(installDir, 'resources'),
      },
    });

    expect(result).toEqual({
      changed: true,
      userDataPath: expectedUserData,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', expectedUserData);
    expect(fs.existsSync(expectedUserData)).toBe(true);
    expect(fs.existsSync(path.join(expectedUserData, '.vlaina'))).toBe(false);
    expect(fs.existsSync(path.join(expectedUserData, 'Preferences'))).toBe(false);
    expect(fs.existsSync(path.join(expectedUserData, 'Local Storage'))).toBe(false);
    expect(fs.existsSync(path.join(expectedUserData, 'Cache'))).toBe(false);
    expect(fs.existsSync(path.join(expectedUserData, 'SingletonLock'))).toBe(false);
    expect(fs.existsSync(path.join(packagedUserData, '.vlaina', 'app', 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(packagedUserData, 'Preferences'))).toBe(true);
    expect(fs.existsSync(path.join(packagedUserData, 'Local Storage', 'leveldb', '000003.log'))).toBe(true);
  });

  it('does not overwrite existing packaged AppData config while moving away from the install directory', async () => {
    const installDir = path.join(tempRoot, 'AppData', 'Local', 'Programs', 'vlaina');
    const roamingAppData = path.join(tempRoot, 'AppData', 'Roaming');
    const expectedUserData = path.join(roamingAppData, 'vlaina');
    const app = createApp({
      isPackaged: true,
      userDataPath: installDir,
      appDataPath: roamingAppData,
    });

    await writeJson(path.join(installDir, '.vlaina', 'app', 'settings.json'), {
      data: { settings: { language: 'zh-CN' } },
    });
    await writeJson(path.join(expectedUserData, '.vlaina', 'app', 'settings.json'), {
      data: { settings: { language: 'en' } },
    });

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      runtime: {
        execPath: path.join(installDir, 'vlaina.exe'),
        resourcesPath: path.join(installDir, 'resources'),
      },
    });

    expect(result).toEqual({
      changed: true,
      userDataPath: expectedUserData,
    });
    await expect(readFile(path.join(expectedUserData, '.vlaina', 'app', 'settings.json'), 'utf8'))
      .resolves.toContain('en');
    await expect(readFile(path.join(expectedUserData, '.vlaina', 'app', 'settings.json'), 'utf8'))
      .resolves.not.toContain('zh-CN');
  });

  it('links an isolated development profile to shared app data when both env paths are provided', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const sharedUserData = path.join(tempRoot, 'shared-user-data');
    const sharedAppData = path.join(sharedUserData, '.vlaina');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await writeJson(path.join(sharedAppData, 'chat', 'sessions', 'index.json'), {
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
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', isolatedUserData);
    expect(fs.lstatSync(linkedAppData).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(linkedAppData)).toBe(fs.realpathSync(sharedAppData));
    await expect(readFile(path.join(linkedAppData, 'chat', 'sessions', 'index.json'), 'utf8'))
      .resolves.toContain('shared-session');
    await expect(readFile(path.join(isolatedUserData, 'Preferences'), 'utf8'))
      .resolves.toContain('dark');
    expect(fs.existsSync(path.join(isolatedUserData, 'SingletonLock'))).toBe(false);
  });

  it('stops development profile shell seeding before copying oversized shared files', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const sharedUserData = path.join(tempRoot, 'shared-user-data');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });
    const oversizedFile = path.join(sharedUserData, 'Preferences');

    await fs.promises.mkdir(sharedUserData, { recursive: true });
    await writeFile(oversizedFile, '', 'utf8');
    await fs.promises.truncate(oversizedFile, 257 * 1024 * 1024);

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      env: {
        VLAINA_USER_DATA_DIR: isolatedUserData,
        VLAINA_SHARED_USER_DATA_DIR: sharedUserData,
      },
    });

    expect(result).toEqual({
      changed: true,
      userDataPath: isolatedUserData,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', isolatedUserData);
    expect(fs.existsSync(path.join(isolatedUserData, 'Preferences'))).toBe(false);
    await expect(readFile(path.join(isolatedUserData, '.vlaina-dev-profile-shell-seeded'), 'utf8'))
      .resolves.toContain(sharedUserData);
  });

  it('stops development profile shell seeding before descending too deeply', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const sharedUserData = path.join(tempRoot, 'shared-user-data');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });
    const shallowFile = path.join(sharedUserData, 'Preferences');
    const deepParts = Array.from({ length: 34 }, (_, index) => `level-${index}`);
    const deepFile = path.join(sharedUserData, ...deepParts, 'deep.txt');

    await fs.promises.mkdir(path.dirname(deepFile), { recursive: true });
    await writeFile(shallowFile, '{"theme":"dark"}\n', 'utf8');
    await writeFile(deepFile, 'too deep\n', 'utf8');

    configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      env: {
        VLAINA_USER_DATA_DIR: isolatedUserData,
        VLAINA_SHARED_USER_DATA_DIR: sharedUserData,
      },
    });

    await expect(readFile(path.join(isolatedUserData, 'Preferences'), 'utf8'))
      .resolves.toContain('dark');
    expect(fs.existsSync(path.join(isolatedUserData, ...deepParts, 'deep.txt'))).toBe(false);
    await expect(readFile(path.join(isolatedUserData, '.vlaina-dev-profile-shell-seeded'), 'utf8'))
      .resolves.toContain(sharedUserData);
  });

  it('refuses to replace an existing isolated .vlaina directory with the shared app data link', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const sharedAppData = path.join(tempRoot, 'shared-user-data', '.vlaina');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await writeJson(path.join(isolatedUserData, '.vlaina', 'chat', 'sessions', 'index.json'), {
      sessions: [{ id: 'wrong-isolated-session' }],
    });
    await writeJson(path.join(sharedAppData, 'chat', 'sessions', 'index.json'), {
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
    await expect(readFile(path.join(linkedAppData, 'chat', 'sessions', 'index.json'), 'utf8'))
      .resolves.toContain('wrong-isolated-session');
    await expect(readFile(path.join(linkedAppData, 'chat', 'sessions', 'index.json'), 'utf8'))
      .resolves.not.toContain('shared-session');
  });

  it('creates a fresh development profile without copying default app data', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const repoRoot = path.join(tempRoot, 'worktree');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await writeJson(path.join(defaultUserData, '.vlaina', 'chat', 'sessions', 'index.json'), {
      sessions: [{ id: 'session-important' }],
    });
    await writeJson(path.join(defaultUserData, '.vlaina', 'notes', 'starred.json'), {
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
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', targetUserData);
    expect(fs.existsSync(path.join(targetUserData, '.vlaina'))).toBe(false);
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
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', targetUserData);
  });

  it('ignores oversized linked worktree git pointer files', async () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const mainRepo = path.join(tempRoot, 'repo');
    const linkedWorktree = path.join(tempRoot, 'worktrees', 'feature');
    const worktreeGitDir = path.join(mainRepo, '.git', 'worktrees', 'feature');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    await fs.promises.mkdir(worktreeGitDir, { recursive: true });
    await fs.promises.mkdir(linkedWorktree, { recursive: true });
    await writeFile(
      path.join(linkedWorktree, '.git'),
      `gitdir: ${worktreeGitDir}\n${'x'.repeat((64 * 1024) + 1)}`,
      'utf8'
    );

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: linkedWorktree,
      env: {},
    });

    const targetUserData = path.join(linkedWorktree, 'temp', 'electron-user-data');
    expect(result).toEqual({
      changed: true,
      userDataPath: targetUserData,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', targetUserData);
  });

});
