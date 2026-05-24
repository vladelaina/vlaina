function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toEncryptionEnvelope(ciphertext) {
  return {
    __secure: 'electron.safeStorage.v1',
    ciphertext: Buffer.from(ciphertext).toString('base64'),
  };
}

function fromEncryptionEnvelope(value) {
  if (!isPlainObject(value)) {
    return null;
  }

  if (value.__secure !== 'electron.safeStorage.v1' || typeof value.ciphertext !== 'string') {
    return null;
  }

  return Buffer.from(value.ciphertext, 'base64');
}

function canEncrypt(safeStorage) {
  return Boolean(safeStorage?.isEncryptionAvailable?.());
}

export function encodeSecretRecord(record, safeStorage, options = {}) {
  const encoded = {};
  const requireEncryption = options.requireEncryption === true;

  if (requireEncryption && !canEncrypt(safeStorage)) {
    throw new Error('System secure storage is unavailable');
  }

  for (const [key, value] of Object.entries(record ?? {})) {
    if (typeof value !== 'string') {
      continue;
    }

    if (!canEncrypt(safeStorage)) {
      encoded[key] = value;
      continue;
    }

    encoded[key] = toEncryptionEnvelope(safeStorage.encryptString(value));
  }

  return encoded;
}

export function decodeSecretRecord(rawRecord, safeStorage, options = {}) {
  if (!isPlainObject(rawRecord)) {
    return {
      record: {},
      needsMigration: false,
    };
  }

  const decoded = {};
  let needsMigration = false;
  const allowPlaintext = options.allowPlaintext !== false;

  for (const [key, value] of Object.entries(rawRecord)) {
    const envelope = fromEncryptionEnvelope(value);
    if (envelope) {
      try {
        decoded[key] = safeStorage.decryptString(envelope);
      } catch {
        needsMigration = true;
      }
      continue;
    }

    if (typeof value === 'string') {
      if (!allowPlaintext) {
        needsMigration = true;
        continue;
      }
      decoded[key] = value;
      needsMigration = needsMigration || canEncrypt(safeStorage);
    }
  }

  return {
    record: decoded,
    needsMigration,
  };
}
