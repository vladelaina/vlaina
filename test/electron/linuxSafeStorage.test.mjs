import { describe, expect, it, vi } from 'vitest';
import {
  configureLinuxSafeStorageBackend,
  isSafeStoragePersistenceAvailable,
} from '../../electron/linuxSafeStorage.mjs';

describe('Linux safe storage', () => {
  it('forces libsecret for Niri before Electron becomes ready', () => {
    const appendSwitch = vi.fn();

    expect(configureLinuxSafeStorageBackend({
      app: { commandLine: { appendSwitch } },
      env: { XDG_CURRENT_DESKTOP: 'niri' },
      platform: 'linux',
    })).toBe(true);
    expect(appendSwitch).toHaveBeenCalledWith('password-store', 'gnome-libsecret');
  });

  it('does not override the backend outside Niri', () => {
    const appendSwitch = vi.fn();

    expect(configureLinuxSafeStorageBackend({
      app: { commandLine: { appendSwitch } },
      env: { XDG_CURRENT_DESKTOP: 'GNOME' },
      platform: 'linux',
    })).toBe(false);
    expect(appendSwitch).not.toHaveBeenCalled();
  });

  it('rejects basic text storage for persistent account sessions', () => {
    expect(isSafeStoragePersistenceAvailable({
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'basic_text',
    }, 'linux')).toBe(false);
  });

  it('accepts Linux system password managers', () => {
    expect(isSafeStoragePersistenceAvailable({
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'gnome_libsecret',
    }, 'linux')).toBe(true);
  });
});
