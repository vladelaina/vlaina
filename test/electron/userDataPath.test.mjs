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

  it('uses an explicit development userData override when provided', () => {
    const defaultUserData = path.join(tempRoot, 'default-user-data');
    const isolatedUserData = path.join(tempRoot, 'isolated-user-data');
    const app = createApp({ isPackaged: false, userDataPath: defaultUserData });

    const result = configureDevelopmentUserDataPath({
      app,
      repoRoot: path.join(tempRoot, 'repo'),
      env: {
        VLAINA_USER_DATA_DIR: isolatedUserData,
      },
    });

    expect(result).toEqual({
      changed: true,
      userDataPath: isolatedUserData,
    });
    expect(app.setPath).toHaveBeenCalledWith('userData', isolatedUserData);
    expect(fs.existsSync(isolatedUserData)).toBe(true);
  });

  it('keeps the default development userData path when no override is provided', async () => {
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

    expect(result).toEqual({
      changed: false,
      userDataPath: defaultUserData,
    });
    expect(app.setPath).not.toHaveBeenCalled();
    await expect(readFile(path.join(defaultUserData, '.vlaina', 'chat', 'sessions', 'index.json'), 'utf8'))
      .resolves.toContain('session-important');
  });
});
