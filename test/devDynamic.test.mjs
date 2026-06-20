import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  chooseAvailablePort,
  configureDevelopmentProfileEnv,
  ensureIsolatedDevelopmentUserDataPath,
} from '../scripts/dev-dynamic.js';

describe('chooseAvailablePort', () => {
  it('uses the preferred port immediately when it is available', async () => {
    const delay = vi.fn();
    const checkPortAvailable = vi.fn(async (port) => port === 3000);

    await expect(
      chooseAvailablePort(3000, {
        checkPortAvailable,
        delay,
        reuseGraceMs: 300,
        retryIntervalMs: 100,
      })
    ).resolves.toBe(3000);

    expect(delay).not.toHaveBeenCalled();
    expect(checkPortAvailable).toHaveBeenCalledTimes(1);
  });

  it('waits briefly for the preferred port to be released before falling back', async () => {
    const delay = vi.fn(async () => {});
    let preferredPortChecks = 0;
    const checkPortAvailable = vi.fn(async (port) => {
      if (port !== 3000) return false;
      preferredPortChecks += 1;
      return preferredPortChecks >= 3;
    });

    await expect(
      chooseAvailablePort(3000, {
        checkPortAvailable,
        delay,
        reuseGraceMs: 300,
        retryIntervalMs: 100,
      })
    ).resolves.toBe(3000);

    expect(delay).toHaveBeenCalledTimes(2);
    expect(checkPortAvailable).toHaveBeenCalledTimes(3);
  });

  it('uses the next available port when the preferred port stays occupied', async () => {
    const delay = vi.fn(async () => {});
    const checkPortAvailable = vi.fn(async (port) => port === 3002);

    await expect(
      chooseAvailablePort(3000, {
        checkPortAvailable,
        delay,
        maxPort: 3005,
        reuseGraceMs: 200,
        retryIntervalMs: 100,
      })
    ).resolves.toBe(3002);

    expect(delay).toHaveBeenCalledTimes(2);
  });

  it('reuses the lowest available port instead of appending after higher occupied ports', async () => {
    const delay = vi.fn(async () => {});
    const occupiedPorts = new Set([3000, 3003, 3004]);
    const checkPortAvailable = vi.fn(async (port) => !occupiedPorts.has(port));

    await expect(
      chooseAvailablePort(3000, {
        checkPortAvailable,
        delay,
        maxPort: 3006,
        reuseGraceMs: 200,
        retryIntervalMs: 100,
      })
    ).resolves.toBe(3001);

    expect(checkPortAvailable).toHaveBeenLastCalledWith(3001);
  });
});

describe('configureDevelopmentProfileEnv', () => {
  it('uses isolated Electron userData for the preferred dev port too', () => {
    const mkdirSync = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const log = vi.fn();
    const env = configureDevelopmentProfileEnv({ HOME: '/home/dev' }, 3000, {
      log,
      targetUserDataPath: '/repo/temp/electron-user-data-3000',
    });

    expect(env.VLAINA_USER_DATA_DIR).toBe('/repo/temp/electron-user-data-3000');
    expect(mkdirSync).toHaveBeenCalledWith('/repo/temp/electron-user-data-3000', {
      recursive: true,
    });
    expect(log).toHaveBeenCalledWith(
      '33',
      'Using isolated Electron userData for dev port 3000: /repo/temp/electron-user-data-3000',
    );

    mkdirSync.mockRestore();
  });

  it('preserves an explicit Electron userData override', () => {
    const mkdirSync = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    const sourceEnv = {
      HOME: '/home/dev',
      VLAINA_USER_DATA_DIR: '/custom/user-data',
    };

    const env = configureDevelopmentProfileEnv(sourceEnv, 3000, {
      targetUserDataPath: '/repo/temp/electron-user-data-3000',
    });

    expect(env).toBe(sourceEnv);
    expect(mkdirSync).not.toHaveBeenCalled();

    mkdirSync.mockRestore();
  });
});

describe('ensureIsolatedDevelopmentUserDataPath', () => {
  it('removes a shared .vlaina symlink before using isolated Electron userData', () => {
    const targetUserDataPath = '/repo/temp/electron-user-data-3000';
    const vlainaDataPath = path.join(targetUserDataPath, '.vlaina');
    const fsModule = {
      mkdirSync: vi.fn(),
      lstatSync: vi.fn(() => ({
        isSymbolicLink: () => true,
      })),
      unlinkSync: vi.fn(),
    };
    const log = vi.fn();

    ensureIsolatedDevelopmentUserDataPath(targetUserDataPath, {
      fsModule,
      log,
    });

    expect(fsModule.mkdirSync).toHaveBeenCalledWith(targetUserDataPath, {
      recursive: true,
    });
    expect(fsModule.lstatSync).toHaveBeenCalledWith(vlainaDataPath);
    expect(fsModule.unlinkSync).toHaveBeenCalledWith(vlainaDataPath);
    expect(fsModule.mkdirSync).toHaveBeenCalledWith(vlainaDataPath, {
      recursive: true,
    });
    expect(log).toHaveBeenCalledWith(
      '33',
      `Removed shared .vlaina symlink from isolated Electron userData: ${vlainaDataPath}`,
    );
  });

  it('keeps an existing real .vlaina directory', () => {
    const fsModule = {
      mkdirSync: vi.fn(),
      lstatSync: vi.fn(() => ({
        isSymbolicLink: () => false,
      })),
      unlinkSync: vi.fn(),
    };

    ensureIsolatedDevelopmentUserDataPath('/repo/temp/electron-user-data-3000', {
      fsModule,
      log: vi.fn(),
    });

    expect(fsModule.unlinkSync).not.toHaveBeenCalled();
    expect(fsModule.mkdirSync).toHaveBeenCalledTimes(1);
  });
});
