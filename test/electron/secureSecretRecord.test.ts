import { describe, expect, it } from 'vitest';
import { decodeSecretRecord, encodeSecretRecord } from '../../electron/secureSecretRecord.mjs';

const availableSafeStorage = {
  isEncryptionAvailable() {
    return true;
  },
  encryptString(value) {
    return Buffer.from(`enc:${value}`, 'utf8');
  },
  decryptString(buffer) {
    const decoded = buffer.toString('utf8');
    return decoded.startsWith('enc:') ? decoded.slice(4) : decoded;
  },
};

const unavailableSafeStorage = {
  isEncryptionAvailable() {
    return false;
  },
  encryptString(value) {
    return Buffer.from(value, 'utf8');
  },
  decryptString(buffer) {
    return buffer.toString('utf8');
  },
};

describe('secure secret record codec', () => {
  it('encrypts string secrets when safe storage is available', () => {
    expect(
      encodeSecretRecord(
        {
          appSessionToken: 'nts_secret',
          ignored: 42,
        },
        availableSafeStorage,
      ),
    ).toEqual({
      appSessionToken: {
        __secure: 'electron.safeStorage.v1',
        ciphertext: Buffer.from('enc:nts_secret', 'utf8').toString('base64'),
      },
    });
  });

  it('decrypts encrypted values back to plain strings', () => {
    expect(
      decodeSecretRecord(
        {
          appSessionToken: {
            __secure: 'electron.safeStorage.v1',
            ciphertext: Buffer.from('enc:nts_secret', 'utf8').toString('base64'),
          },
        },
        availableSafeStorage,
      ),
    ).toEqual({
      record: {
        appSessionToken: 'nts_secret',
      },
      needsMigration: false,
    });
  });

  it('marks plaintext records for migration when encryption is available', () => {
    expect(
      decodeSecretRecord(
        {
          openai: 'sk-live',
        },
        availableSafeStorage,
      ),
    ).toEqual({
      record: {
        openai: 'sk-live',
      },
      needsMigration: true,
    });
  });

  it('keeps plaintext records unchanged when encryption is unavailable', () => {
    expect(
      decodeSecretRecord(
        {
          openai: 'sk-live',
        },
        unavailableSafeStorage,
      ),
    ).toEqual({
      record: {
        openai: 'sk-live',
      },
      needsMigration: false,
    });
  });
});
