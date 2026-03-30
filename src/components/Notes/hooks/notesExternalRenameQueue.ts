export interface PendingRenameEntry {
  oldPath: string;
  expiresAt: number;
}

export function queuePendingRename(
  queue: PendingRenameEntry[],
  oldPath: string,
  now: number,
  ttlMs: number
): PendingRenameEntry[] {
  return [...flushExpiredPendingRenames(queue, now).queue, { oldPath, expiresAt: now + ttlMs }];
}

export function matchPendingRename(
  queue: PendingRenameEntry[],
  now: number
): { queue: PendingRenameEntry[]; oldPath: string | null } {
  const { queue: nextQueue } = flushExpiredPendingRenames(queue, now);
  const [matchedEntry, ...remainingQueue] = nextQueue;

  return {
    queue: remainingQueue,
    oldPath: matchedEntry?.oldPath ?? null,
  };
}

export function flushExpiredPendingRenames(
  queue: PendingRenameEntry[],
  now: number
): { queue: PendingRenameEntry[]; expiredPaths: string[] } {
  const expiredPaths: string[] = [];
  const nextQueue: PendingRenameEntry[] = [];

  for (const entry of queue) {
    if (entry.expiresAt <= now) {
      expiredPaths.push(entry.oldPath);
      continue;
    }

    nextQueue.push(entry);
  }

  return { queue: nextQueue, expiredPaths };
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
