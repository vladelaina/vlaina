import { describe, expect, it, vi } from 'vitest';
import { chooseAvailablePort } from '../scripts/dev-dynamic.js';

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
});
