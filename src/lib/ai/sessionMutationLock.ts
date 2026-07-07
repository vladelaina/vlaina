import { getSessionIdAliasesResolvingTo, resolveSessionIdAlias } from './sessionIdAliases';
import { isSafeChatSessionId } from '@/lib/storage/unifiedStorageAI';
import {
  createToken,
  LOCK_KEY_PREFIX,
  LOCK_TTL_MS,
  readLockRecord,
  removeLockRecord,
  sessionMutationLockSourceId,
  tryAcquireLock,
  writeLockRecord,
} from './sessionMutationLockStorage';

const CHANNEL_NAME = 'vlaina-session-mutation-lock';
const LOCK_RENEW_MS = 5000;
const LOCK_WAIT_MS = 350;
const MAX_LOCK_CHANGE_FIELD_CHARS = 512;
const sourceId = sessionMutationLockSourceId;

const queuedMutations = new Map<string, Promise<void>>();
const listeners = new Set<(sessionId: string) => void>();
let broadcastChannel: BroadcastChannel | null = null;
let storageListenerBound = false;

function notifyListeners(sessionId: string) {
  listeners.forEach((listener) => {
    try {
      listener(sessionId);
    } catch {
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseLockChangeMessage(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  if (!isSafeChatSessionId(value.sessionId)) {
    return null;
  }
  if (
    typeof value.sourceId === 'string' &&
    (value.sourceId === sourceId || value.sourceId.length > MAX_LOCK_CHANGE_FIELD_CHARS)
  ) {
    return null;
  }
  if (value.sourceId !== undefined && typeof value.sourceId !== 'string') {
    return null;
  }
  if (
    value.nonce !== undefined &&
    (typeof value.nonce !== 'string' || value.nonce.length > MAX_LOCK_CHANGE_FIELD_CHARS)
  ) {
    return null;
  }

  return value.sessionId;
}

function ensureBroadcastChannel() {
  if (broadcastChannel || typeof BroadcastChannel === 'undefined') {
    return;
  }

  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (message) => {
      const sessionId = parseLockChangeMessage(message.data);
      if (!sessionId) {
        return;
      }

      notifyListeners(sessionId);
    };
  } catch {
    broadcastChannel = null;
  }
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
    if (!isSafeChatSessionId(sessionId)) {
      return;
    }

    notifyListeners(sessionId);
  });

  storageListenerBound = true;
}

function emitLockChange(sessionId: string) {
  ensureBroadcastChannel();
  try {
    broadcastChannel?.postMessage({ sessionId, sourceId, nonce: createToken() });
  } catch {
  }
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

function normalizeSessionMutationLockIds(sessionIds: string[]): string[] {
  const normalized = new Set<string>();

  sessionIds.forEach((sessionId) => {
    const trimmedSessionId = sessionId.trim();
    if (!trimmedSessionId) {
      return;
    }

    const resolvedSessionId = resolveSessionIdAlias(trimmedSessionId);
    normalized.add(trimmedSessionId);
    if (resolvedSessionId.trim()) {
      normalized.add(resolvedSessionId);
      getSessionIdAliasesResolvingTo(resolvedSessionId).forEach((aliasSessionId) => {
        normalized.add(aliasSessionId);
      });
    }
  });

  return Array.from(normalized).sort();
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

        const renewed = writeLockRecord(sessionId, {
          ...current,
          expiresAt: Date.now() + LOCK_TTL_MS,
        });
        if (!renewed) {
          window.clearInterval(renewTimer);
        }
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
  const normalizedSessionIds = normalizeSessionMutationLockIds(sessionIds);
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
