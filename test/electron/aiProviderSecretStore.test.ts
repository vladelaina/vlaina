import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

describe('aiProviderSecretStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    mocks.userDataPath = await mkdtemp(path.join(os.tmpdir(), 'vlaina-ai-secrets-'));
  });

  afterEach(async () => {
    await rm(mocks.userDataPath, { recursive: true, force: true });
  });

  it('serializes concurrent secret updates without losing keys', async () => {
    const { readSecretsStore, updateSecretsStore } = await import('../../electron/aiProviderSecretStore.mjs');

    await Promise.all([
      updateSecretsStore(async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        data['provider-a'] = 'sk-a';
      }),
      updateSecretsStore(async (data) => {
        data['provider-b'] = 'sk-b';
      }),
    ]);

    await expect(readSecretsStore()).resolves.toMatchObject({
      data: {
        'provider-a': 'sk-a',
        'provider-b': 'sk-b',
      },
    });
  });

  it('drops unsafe legacy provider ids from the secret file', async () => {
    const { readSecretsStore } = await import('../../electron/aiProviderSecretStore.mjs');
    const secretsPath = path.join(
      mocks.userDataPath,
      '.vlaina',
      'secrets',
      'ai-provider-secrets.json',
    );
    await mkdir(path.dirname(secretsPath), { recursive: true });
    await writeFile(secretsPath, JSON.stringify({
      'provider-a': 'sk-a',
      '../outside': 'sk-outside',
      'provider/slash': 'sk-slash',
    }), 'utf8');

    await expect(readSecretsStore()).resolves.toMatchObject({
      data: {
        'provider-a': 'sk-a',
      },
    });
    expect(await readFile(secretsPath, 'utf8')).not.toContain('../outside');
    expect(await readFile(secretsPath, 'utf8')).not.toContain('provider/slash');
  });
});
