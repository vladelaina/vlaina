import { describe, expect, it, vi } from 'vitest';
import {
  chooseAvailablePort,
  configureDevelopmentProfileEnv,
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
    const copyProfileSnapshot = vi.fn(() => false);
    const log = vi.fn();
    const env = configureDevelopmentProfileEnv({ HOME: '/home/dev' }, 3000, {
      copyProfileSnapshot,
      log,
      sourceUserDataPath: '/home/dev/.config/vlaina',
      targetUserDataPath: '/repo/temp/electron-user-data-3000',
    });

    expect(env.VLAINA_USER_DATA_DIR).toBe('/repo/temp/electron-user-data-3000');
    expect(copyProfileSnapshot).toHaveBeenCalledWith(
      '/home/dev/.config/vlaina',
      '/repo/temp/electron-user-data-3000',
    );
  });

  it('preserves an explicit Electron userData override', () => {
    const copyProfileSnapshot = vi.fn(() => false);
    const sourceEnv = {
      HOME: '/home/dev',
      VLAINA_USER_DATA_DIR: '/custom/user-data',
    };

    const env = configureDevelopmentProfileEnv(sourceEnv, 3000, {
      copyProfileSnapshot,
      targetUserDataPath: '/repo/temp/electron-user-data-3000',
    });

    expect(env).toBe(sourceEnv);
    expect(copyProfileSnapshot).not.toHaveBeenCalled();
  });
});
