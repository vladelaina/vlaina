import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userDataPath: '',
  encryptionAvailable: true,
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
        return mocks.encryptionAvailable;
      },
      encryptString(value: string) {
        return Buffer.from(`enc:${value}`, 'utf8');
      },
      decryptString(buffer: Buffer) {
        const decoded = buffer.toString('utf8');
        return decoded.startsWith('enc:') ? decoded.slice(4) : decoded;
      },
    },
  },
}));

describe('accountCredentialStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.userDataPath = await mkdtemp(path.join(os.tmpdir(), 'vlaina-account-store-'));
    mocks.encryptionAvailable = true;
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
      provider: 'google',
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

  it('stores account session tokens only as encrypted records', async () => {
    const { createAccountCredentialStore } = await import('../../electron/accountCredentialStore.mjs');
    const store = createAccountCredentialStore({
      desktopLegacySessionHeader: 'x-app-session-token',
    });

    await store.writeStoredAccountCredentials({
      appSessionToken: 'nts_super_secret_token',
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      authenticatedAt: 1,
    });

    const secretsPath = path.join(mocks.userDataPath, '.vlaina', 'store', 'account-secrets.json');
    const rawSecrets = await readFile(secretsPath, 'utf8');
    expect(rawSecrets).not.toContain('nts_super_secret_token');
    expect(JSON.parse(rawSecrets).appSessionToken).toMatchObject({
      __secure: 'electron.safeStorage.v1',
    });
  });

  it('keeps account session tokens in memory when safe storage is unavailable', async () => {
    mocks.encryptionAvailable = false;
    const { createAccountCredentialStore } = await import('../../electron/accountCredentialStore.mjs');
    const store = createAccountCredentialStore({
      desktopLegacySessionHeader: 'x-app-session-token',
    });

    await store.writeStoredAccountCredentials({
      appSessionToken: 'nts_super_secret_token',
      provider: 'google',
      username: 'alice',
      primaryEmail: 'alice@example.com',
      avatarUrl: null,
      authenticatedAt: 1,
    });

    await expect(store.readStoredAccountCredentials()).resolves.toMatchObject({
      appSessionToken: 'nts_super_secret_token',
      provider: 'google',
      username: 'alice',
      persistent: false,
    });

    const secretsPath = path.join(mocks.userDataPath, '.vlaina', 'store', 'account-secrets.json');
    await expect(readFile(secretsPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('ignores and removes plaintext account session token records', async () => {
    const { createAccountCredentialStore } = await import('../../electron/accountCredentialStore.mjs');
    const store = createAccountCredentialStore({
      desktopLegacySessionHeader: 'x-app-session-token',
    });
    const storeDir = path.join(mocks.userDataPath, '.vlaina', 'store');
    const metaPath = path.join(storeDir, 'account-meta.json');
    const secretsPath = path.join(storeDir, 'account-secrets.json');

    await mkdir(storeDir, { recursive: true });
    await writeFile(metaPath, JSON.stringify({ provider: 'google', username: 'alice' }), 'utf8');
    await writeFile(secretsPath, JSON.stringify({ appSessionToken: 'nts_plaintext' }), 'utf8');

    await expect(store.readStoredAccountCredentials()).resolves.toBeNull();
    await expect(readFile(secretsPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
