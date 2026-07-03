import { describe, expect, it, vi } from 'vitest';
import { runDesktopUpdateAutoCheck } from './useDesktopUpdateRuntime';

describe('runDesktopUpdateAutoCheck', () => {
  it('notifies and records the check time when an update is available', async () => {
    const notifyUpdateAvailable = vi.fn();
    const markCheckedAt = vi.fn();
    const recordUpdateInfo = vi.fn();
    const updateInfo = {
      latestVersion: '1.2.3',
      updateAvailable: true,
    };

    await runDesktopUpdateAutoCheck({
      checkForUpdates: vi.fn().mockResolvedValue(updateInfo),
      recordUpdateInfo,
      notifyUpdateAvailable,
      markCheckedAt,
      getNow: () => 12345,
    });

    expect(notifyUpdateAvailable).toHaveBeenCalledWith({
      latestVersion: '1.2.3',
      updateAvailable: true,
    });
    expect(recordUpdateInfo).toHaveBeenCalledWith(updateInfo);
    expect(markCheckedAt).toHaveBeenCalledWith(12345);
  });

  it('records the check time without notifying when the app is current', async () => {
    const notifyUpdateAvailable = vi.fn();
    const markCheckedAt = vi.fn();

    await runDesktopUpdateAutoCheck({
      checkForUpdates: vi.fn().mockResolvedValue({
        latestVersion: '1.2.3',
        updateAvailable: false,
      }),
      notifyUpdateAvailable,
      markCheckedAt,
      getNow: () => 23456,
    });

    expect(notifyUpdateAvailable).not.toHaveBeenCalled();
    expect(markCheckedAt).toHaveBeenCalledWith(23456);
  });

  it('does not record the check time when the update check fails', async () => {
    const notifyUpdateAvailable = vi.fn();
    const markCheckedAt = vi.fn();

    await expect(runDesktopUpdateAutoCheck({
      checkForUpdates: vi.fn().mockRejectedValue(new Error('network failed')),
      notifyUpdateAvailable,
      markCheckedAt,
      getNow: () => 34567,
    })).rejects.toThrow('network failed');

    expect(notifyUpdateAvailable).not.toHaveBeenCalled();
    expect(markCheckedAt).not.toHaveBeenCalled();
  });
});
