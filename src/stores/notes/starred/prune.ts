import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { StarredEntry } from '../types';
import {
  dedupeStarredEntries,
  type StarredRegistry,
} from './registry';

async function isStarredEntryValid(entry: StarredEntry): Promise<boolean> {
  const storage = getStorageAdapter();

  const notesRootExists = await storage.exists(entry.notesRootPath);
  if (!notesRootExists) {
    return false;
  }

  const notesRootInfo = await storage.stat(entry.notesRootPath);
  if (notesRootInfo?.isDirectory === false) {
    return false;
  }

  const fullPath = await joinPath(entry.notesRootPath, entry.relativePath);
  const targetExists = await storage.exists(fullPath);
  if (!targetExists) {
    return false;
  }

  const targetInfo = await storage.stat(fullPath);
  if (!targetInfo) {
    return true;
  }

  return entry.kind === 'folder'
    ? targetInfo.isDirectory !== false
    : targetInfo.isFile !== false;
}

export async function pruneInvalidStarredEntries(entries: StarredEntry[]): Promise<{
  entries: StarredRegistry['entries'];
  changed: boolean;
}> {
  if (entries.length === 0) {
    return { entries, changed: false };
  }

  const validEntries: StarredEntry[] = [];
  const batchSize = 12;

  for (let index = 0; index < entries.length; index += batchSize) {
    const batch = entries.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (entry) => ({
        entry,
        valid: await isStarredEntryValid(entry),
      }))
    );

    results.forEach((result) => {
      if (result.valid) {
        validEntries.push(result.entry);
      }
    });
  }

  const dedupedEntries = dedupeStarredEntries(validEntries);
  const changed = dedupedEntries.length !== entries.length;

  return {
    entries: dedupedEntries,
    changed,
  };
}
