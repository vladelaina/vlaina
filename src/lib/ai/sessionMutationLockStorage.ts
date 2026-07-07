type SessionMutationLockRecord = {
  ownerId: string;
  token: string;
  expiresAt: number;
};

export const LOCK_KEY_PREFIX = 'vlaina-session-mutation-lock:';
export const LOCK_TTL_MS = 15000;

const MAX_LOCK_RECORD_STORAGE_CHARS = 8 * 1024;

export const sessionMutationLockSourceId = (() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

export function createToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getLockKey(sessionId: string) {
  return `${LOCK_KEY_PREFIX}${sessionId}`;
}

function parseLockRecord(value: string | null): SessionMutationLockRecord | null {
  if (!value) {
    return null;
  }
  if (value.length > MAX_LOCK_RECORD_STORAGE_CHARS) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SessionMutationLockRecord>;
    if (
      typeof parsed.ownerId !== 'string' ||
      parsed.ownerId.length > 512 ||
      typeof parsed.token !== 'string' ||
      parsed.token.length > 512 ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }

    return {
      ownerId: parsed.ownerId,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function readLockRecord(sessionId: string): SessionMutationLockRecord | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    return parseLockRecord(localStorage.getItem(getLockKey(sessionId)));
  } catch {
    return null;
  }
}

function isLockActive(record: SessionMutationLockRecord | null) {
  return !!record && record.expiresAt > Date.now();
}

export function writeLockRecord(sessionId: string, record: SessionMutationLockRecord) {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  try {
    localStorage.setItem(getLockKey(sessionId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function removeLockRecord(sessionId: string, token: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const current = readLockRecord(sessionId);
  if (!current || current.token !== token || current.ownerId !== sessionMutationLockSourceId) {
    return;
  }

  try {
    localStorage.removeItem(getLockKey(sessionId));
  } catch {
  }
}

export function tryAcquireLock(sessionId: string, token: string): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }

  const current = readLockRecord(sessionId);
  if (isLockActive(current)) {
    return false;
  }

  const nextRecord: SessionMutationLockRecord = {
    ownerId: sessionMutationLockSourceId,
    token,
    expiresAt: Date.now() + LOCK_TTL_MS,
  };

  if (!writeLockRecord(sessionId, nextRecord)) {
    return true;
  }

  const verified = readLockRecord(sessionId);
  if (!verified) {
    return false;
  }

  return verified.ownerId === sessionMutationLockSourceId && verified.token === token;
}
