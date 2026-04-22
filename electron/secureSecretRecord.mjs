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

export function encodeSecretRecord(record, safeStorage) {
  const encoded = {};

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

export function decodeSecretRecord(rawRecord, safeStorage) {
  if (!isPlainObject(rawRecord)) {
    return {
      record: {},
      needsMigration: false,
    };
  }

  const decoded = {};
  let needsMigration = false;

  for (const [key, value] of Object.entries(rawRecord)) {
    const envelope = fromEncryptionEnvelope(value);
    if (envelope) {
      decoded[key] = safeStorage.decryptString(envelope);
      continue;
    }

    if (typeof value === 'string') {
      decoded[key] = value;
      needsMigration = needsMigration || canEncrypt(safeStorage);
    }
  }

  return {
    record: decoded,
    needsMigration,
  };
}
