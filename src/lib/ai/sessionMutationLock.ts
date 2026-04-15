type SessionMutationLockRecord = {
  ownerId: string;
  token: string;
  expiresAt: number;
};

const LOCK_KEY_PREFIX = 'vlaina-session-mutation-lock:';
const CHANNEL_NAME = 'vlaina-session-mutation-lock';
const LOCK_TTL_MS = 15000;
const LOCK_RENEW_MS = 5000;
const LOCK_WAIT_MS = 350;

const sourceId = (() => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
})();

const queuedMutations = new Map<string, Promise<void>>();
const listeners = new Set<(sessionId: string) => void>();
let broadcastChannel: BroadcastChannel | null = null;
let storageListenerBound = false;

function createToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getLockKey(sessionId: string) {
  return `${LOCK_KEY_PREFIX}${sessionId}`;
}

function notifyListeners(sessionId: string) {
  listeners.forEach((listener) => {
    listener(sessionId);
  });
}

function ensureBroadcastChannel() {
  if (broadcastChannel || typeof BroadcastChannel === 'undefined') {
    return;
  }

  broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  broadcastChannel.onmessage = (message) => {
    const sessionId =
      message.data && typeof message.data === 'object' && typeof message.data.sessionId === 'string'
        ? message.data.sessionId
        : null;
    if (!sessionId) {
      return;
    }

    notifyListeners(sessionId);
  };
}

function ensureStorageListener() {
  if (storageListenerBound || typeof window === 'undefined') {
    return;
  }

  window.addEventListener('storage', (event) => {
    if (!event.key?.startsWith(LOCK_KEY_PREFIX)) {
      return;
    }

    const sessionId = event.key.slice(LOCK_KEY_PREFIX.length);
    if (!sessionId) {
      return;
    }

    notifyListeners(sessionId);
  });

  storageListenerBound = true;
}

function emitLockChange(sessionId: string) {
  ensureBroadcastChannel();
  broadcastChannel?.postMessage({ sessionId, sourceId, nonce: createToken() });
}

function parseLockRecord(value: string | null): SessionMutationLockRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SessionMutationLockRecord>;
    if (
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'number'
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

function readLockRecord(sessionId: string): SessionMutationLockRecord | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return parseLockRecord(localStorage.getItem(getLockKey(sessionId)));
}

function isLockActive(record: SessionMutationLockRecord | null) {
  return !!record && record.expiresAt > Date.now();
}

function writeLockRecord(sessionId: string, record: SessionMutationLockRecord) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(getLockKey(sessionId), JSON.stringify(record));
}

function removeLockRecord(sessionId: string, token: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const current = readLockRecord(sessionId);
  if (!current || current.token !== token || current.ownerId !== sourceId) {
    return;
  }

  localStorage.removeItem(getLockKey(sessionId));
}

function tryAcquireLock(sessionId: string, token: string): boolean {
  if (typeof localStorage === 'undefined') {
    return true;
  }

  const current = readLockRecord(sessionId);
  if (isLockActive(current)) {
    return false;
  }

  const nextRecord: SessionMutationLockRecord = {
    ownerId: sourceId,
    token,
    expiresAt: Date.now() + LOCK_TTL_MS,
  };

  writeLockRecord(sessionId, nextRecord);

  const verified = readLockRecord(sessionId);
  if (!verified) {
    return false;
  }

  return verified.ownerId === sourceId && verified.token === token;
}

function waitForLockChange(sessionId: string): Promise<void> {
  ensureBroadcastChannel();
  ensureStorageListener();

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      listeners.delete(handleChange);
      resolve();
    }, LOCK_WAIT_MS);

    const handleChange = (changedSessionId: string) => {
      if (changedSessionId !== sessionId) {
        return;
      }

      window.clearTimeout(timer);
      listeners.delete(handleChange);
      resolve();
    };

    listeners.add(handleChange);
  });
}

async function acquireSessionMutationLock(sessionId: string): Promise<() => void> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return () => {};
  }

  const token = createToken();

  for (;;) {
    if (tryAcquireLock(sessionId, token)) {
      let released = false;
      const renewTimer = window.setInterval(() => {
        const current = readLockRecord(sessionId);
        if (!current || current.ownerId !== sourceId || current.token !== token) {
          window.clearInterval(renewTimer);
          return;
        }

        writeLockRecord(sessionId, {
          ...current,
          expiresAt: Date.now() + LOCK_TTL_MS,
        });
      }, LOCK_RENEW_MS);

      return () => {
        if (released) {
          return;
        }

        released = true;
        window.clearInterval(renewTimer);
        removeLockRecord(sessionId, token);
        emitLockChange(sessionId);
      };
    }

    await waitForLockChange(sessionId);
  }
}

export async function runWithSessionMutationLock<T>(
  sessionId: string,
  task: () => Promise<T> | T,
): Promise<T> {
  return runWithSessionMutationLocks([sessionId], task);
}

export async function runWithSessionMutationLocks<T>(
  sessionIds: string[],
  task: () => Promise<T> | T,
): Promise<T> {
  const normalizedSessionIds = [...new Set(sessionIds)].sort();
  if (normalizedSessionIds.length === 0) {
    return await task();
  }

  const previous = Promise.all(
    normalizedSessionIds.map((sessionId) =>
      (queuedMutations.get(sessionId) || Promise.resolve()).catch(() => undefined),
    ),
  );

  const run = previous.then(async () => {
    const releases: Array<() => void> = [];

    try {
      for (const sessionId of normalizedSessionIds) {
        releases.push(await acquireSessionMutationLock(sessionId));
      }

      return await task();
    } finally {
      for (let index = releases.length - 1; index >= 0; index -= 1) {
        releases[index]();
      }
    }
  });

  const settled = run.then(() => undefined, () => undefined);
  normalizedSessionIds.forEach((sessionId) => {
    queuedMutations.set(sessionId, settled);
  });

  try {
    return await run;
  } finally {
    normalizedSessionIds.forEach((sessionId) => {
      if (queuedMutations.get(sessionId) === settled) {
        queuedMutations.delete(sessionId);
      }
    });
  }
}
