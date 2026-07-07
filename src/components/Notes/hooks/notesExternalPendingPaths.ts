import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import {
  flushExpiredPendingRenames,
  type PendingRenameEntry,
} from './notesExternalRenameQueue';
import type { PendingCreateEntry } from './notesExternalSyncActionTypes';

export function queuePendingCreate(
  queue: PendingCreateEntry[],
  newPath: string,
  now: number,
  ttlMs: number,
  kind?: string | null
): PendingCreateEntry[] {
  const activeQueue = flushExpiredPendingCreates(queue, now).queue;
  const existingIndex = activeQueue.findIndex((entry) => entry.newPath === newPath);
  if (existingIndex >= 0) {
    return activeQueue.map((entry, index) => (
      index === existingIndex
        ? {
            newPath,
            expiresAt: now + ttlMs,
            kind: mergePendingPathKind(entry.kind, kind),
          }
        : entry
    ));
  }

  return [...activeQueue, { newPath, expiresAt: now + ttlMs, kind }];
}

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

export function flushExpiredPendingCreates(
  queue: PendingCreateEntry[],
  now: number
): { queue: PendingCreateEntry[]; expiredEntries: PendingCreateEntry[] } {
  const expiredEntries: PendingCreateEntry[] = [];
  const nextQueue: PendingCreateEntry[] = [];

  for (const entry of queue) {
    if (entry.expiresAt <= now) {
      expiredEntries.push(entry);
      continue;
    }

    nextQueue.push(entry);
  }

  return { queue: nextQueue, expiredEntries };
}

export function getNextPendingCreateDelay(queue: PendingCreateEntry[], now: number): number | null {
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

export function getWatchEventPathKind(event: DesktopWatchEvent): string | null {
  if (typeof event.type === 'string') {
    return null;
  }

  if ('create' in event.type) {
    return event.type.create.kind ?? null;
  }

  if ('remove' in event.type) {
    return event.type.remove.kind ?? null;
  }

  return null;
}

function getParentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index) : '';
}

function getBaseName(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(index + 1) : path;
}

function getRenameEndpointScore(sourcePath: string, candidatePath: string): number {
  let score = 0;
  if (getParentPath(sourcePath) === getParentPath(candidatePath)) {
    score += 2;
  }
  if (getBaseName(sourcePath) === getBaseName(candidatePath)) {
    score += 1;
  }
  return score;
}

export function takeBestPendingRename(
  queue: PendingRenameEntry[],
  now: number,
  newPath: string,
  canPairKinds: (oldKind: string | null | undefined, newKind: string | null | undefined) => boolean,
  newKind?: string | null
): { queue: PendingRenameEntry[]; oldPath: string | null; kind: string | null } {
  const { queue: nextQueue } = flushExpiredPendingRenames(queue, now);
  const compatible = nextQueue
    .map((entry, index) => ({ entry, index, score: getRenameEndpointScore(entry.oldPath, newPath) }))
    .filter(({ entry }) => canPairKinds(entry.kind, newKind));
  const bestScore = compatible.reduce<number | null>(
    (best, candidate) => best == null || candidate.score > best ? candidate.score : best,
    null
  );
  const bestCandidates = compatible.filter((candidate) => candidate.score === bestScore);
  if (bestCandidates.length !== 1) {
    return { queue: nextQueue, oldPath: null, kind: null };
  }

  const best = bestCandidates[0];
  return {
    queue: nextQueue.filter((_, index) => index !== best.index),
    oldPath: best.entry.oldPath,
    kind: best.entry.kind ?? null,
  };
}

export function takeBestPendingCreate(
  queue: PendingCreateEntry[],
  now: number,
  oldPath: string,
  canPairKinds: (oldKind: string | null | undefined, newKind: string | null | undefined) => boolean,
  oldKind?: string | null
): { queue: PendingCreateEntry[]; newPath: string | null; kind: string | null } {
  const { queue: nextQueue } = flushExpiredPendingCreates(queue, now);
  const compatible = nextQueue
    .map((entry, index) => ({ entry, index, score: getRenameEndpointScore(oldPath, entry.newPath) }))
    .filter(({ entry }) => canPairKinds(oldKind, entry.kind));
  const bestScore = compatible.reduce<number | null>(
    (best, candidate) => best == null || candidate.score > best ? candidate.score : best,
    null
  );
  const bestCandidates = compatible.filter((candidate) => candidate.score === bestScore);
  if (bestCandidates.length !== 1) {
    return { queue: nextQueue, newPath: null, kind: null };
  }

  const best = bestCandidates[0];
  return {
    queue: nextQueue.filter((_, index) => index !== best.index),
    newPath: best.entry.newPath,
    kind: best.entry.kind ?? null,
  };
}
