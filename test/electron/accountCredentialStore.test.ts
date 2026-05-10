import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userDataPath: '',
}));

vi.mock('electron', () => ({
  default: {
    app: {
      getPath(name: string) {
        if (name !== 'userData') {
          throw new Error(`Unexpected app path: ${name}`);
        }
        return mocks.userDataPath;
      },
    },
    safeStorage: {
      isEncryptionAvailable() {
        return false;
      },
      encryptString(value: string) {
        return Buffer.from(value, 'utf8');
      },
      decryptString(buffer: Buffer) {
        return buffer.toString('utf8');
      },
    },
  },
}));

describe('accountCredentialStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.userDataPath = await mkdtemp(path.join(os.tmpdir(), 'vlaina-account-store-'));
  });

  afterEach(async () => {
    await rm(mocks.userDataPath, { recursive: true, force: true });
  });

  it('does not pass raw session tokens into auth log details', async () => {
    const { createAccountCredentialStore } = await import('../../electron/accountCredentialStore.mjs');
    const logDesktopAuth = vi.fn();
    const store = createAccountCredentialStore({
      desktopLegacySessionHeader: 'x-app-session-token',
      logDesktopAuth,
    });

    await store.writeStoredAccountCredentials({
      appSessionToken: 'nts_super_secret_token',
      provider: 'github',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      authenticatedAt: 1,
    });
    await store.readStoredAccountCredentials();
    await store.rotateStoredSessionToken(new Headers({ 'x-app-session-token': 'nts_rotated_secret' }));

    expect(JSON.stringify(logDesktopAuth.mock.calls)).not.toContain('nts_super_secret_token');
    expect(JSON.stringify(logDesktopAuth.mock.calls)).not.toContain('nts_rotated_secret');
  });
});
