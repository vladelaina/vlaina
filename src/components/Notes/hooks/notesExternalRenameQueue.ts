export interface PendingRenameEntry {
  oldPath: string;
  expiresAt: number;
  kind?: string | null;
}

export const MAX_PROCESSED_RENAME_EVENT_NONCES = 200;

function mergePendingPathKind(
  existingKind: string | null | undefined,
  nextKind: string | null | undefined,
): string | null | undefined {
  const existingIsUnknown = !existingKind || existingKind === 'any';
  const nextIsUnknown = !nextKind || nextKind === 'any';
  if (existingIsUnknown) {
    return nextKind ?? existingKind;
  }
  if (nextIsUnknown) {
    return existingKind;
  }
  return existingKind === nextKind ? existingKind : null;
}

export function rememberProcessedRenameEventNonce(
  processedNonces: Set<string>,
  nonce: string,
  maxNonces = MAX_PROCESSED_RENAME_EVENT_NONCES,
): boolean {
  if (processedNonces.has(nonce)) {
    return false;
  }

  processedNonces.add(nonce);

  while (processedNonces.size > maxNonces) {
    const oldestNonce = processedNonces.keys().next().value;
    if (oldestNonce === undefined) {
      break;
    }
    processedNonces.delete(oldestNonce);
  }

  return true;
}

export function queuePendingRename(
  queue: PendingRenameEntry[],
  oldPath: string,
  now: number,
  ttlMs: number,
  kind?: string | null
): PendingRenameEntry[] {
  const activeQueue = flushExpiredPendingRenames(queue, now).queue;
  const existingIndex = activeQueue.findIndex((entry) => entry.oldPath === oldPath);
  if (existingIndex >= 0) {
    return activeQueue.map((entry, index) => (
      index === existingIndex
        ? {
            oldPath,
            expiresAt: now + ttlMs,
            kind: mergePendingPathKind(entry.kind, kind),
          }
        : entry
    ));
  }

  return [...activeQueue, { oldPath, expiresAt: now + ttlMs, kind }];
}

export function matchPendingRename(
  queue: PendingRenameEntry[],
  now: number
): { queue: PendingRenameEntry[]; oldPath: string | null; kind: string | null } {
  const { queue: nextQueue } = flushExpiredPendingRenames(queue, now);
  const [matchedEntry, ...remainingQueue] = nextQueue;

  return {
    queue: remainingQueue,
    oldPath: matchedEntry?.oldPath ?? null,
    kind: matchedEntry?.kind ?? null,
  };
}

export function flushExpiredPendingRenames(
  queue: PendingRenameEntry[],
  now: number
): { queue: PendingRenameEntry[]; expiredPaths: string[]; expiredEntries: PendingRenameEntry[] } {
  const expiredPaths: string[] = [];
  const expiredEntries: PendingRenameEntry[] = [];
  const nextQueue: PendingRenameEntry[] = [];

  for (const entry of queue) {
    if (entry.expiresAt <= now) {
      expiredPaths.push(entry.oldPath);
      expiredEntries.push(entry);
      continue;
    }

    nextQueue.push(entry);
  }

  return { queue: nextQueue, expiredPaths, expiredEntries };
}

export function getNextPendingRenameDelay(queue: PendingRenameEntry[], now: number): number | null {
  const nextExpiresAt = queue.reduce<number | null>((earliest, entry) => {
    if (earliest == null || entry.expiresAt < earliest) {
      return entry.expiresAt;
    }
    return earliest;
  }, null);

  if (nextExpiresAt == null) {
    return null;
  }

  return Math.max(0, nextExpiresAt - now);
}
