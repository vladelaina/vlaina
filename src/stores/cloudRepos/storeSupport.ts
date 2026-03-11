import type { StoreApi } from 'zustand';
import type {
  CloudRepoDraftCounts,
  CloudRepoDraftRecord,
  CloudRepoNode,
  CloudRepoStore,
  CloudRepoSyncStatus,
} from './types';

export type CloudRepoSet = StoreApi<CloudRepoStore>['setState'];
export type CloudRepoGet = StoreApi<CloudRepoStore>['getState'];

const syncTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function buildSyncCommitMessage(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `sync: ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function createCommitMessage(action: string, path: string): string {
  return `${action}: ${path}`;
}

export function clearSyncTimer(repositoryId: number): void {
  const timer = syncTimers.get(repositoryId);
  if (!timer) return;
  clearTimeout(timer);
  syncTimers.delete(repositoryId);
}

export function registerSyncTimer(
  repositoryId: number,
  timer: ReturnType<typeof setTimeout>
): void {
  syncTimers.set(repositoryId, timer);
}

export function collectTreePaths(
  nodes: CloudRepoNode[],
  paths = new Set<string>()
): Set<string> {
  for (const node of nodes) {
    paths.add(node.path);
    if (node.kind === 'folder' && node.children?.length) {
      collectTreePaths(node.children, paths);
    }
  }
  return paths;
}

export function isPathWithinFolder(path: string, folderPath: string): boolean {
  return path === folderPath || path.startsWith(`${folderPath}/`);
}

export function getDraftCountsForRepository(
  drafts: Iterable<CloudRepoDraftRecord>,
  repositoryId: number
): CloudRepoDraftCounts {
  let dirty = 0;
  let conflict = 0;

  for (const draft of drafts) {
    if (draft.repositoryId !== repositoryId) continue;
    if (draft.state === 'conflict') {
      conflict += 1;
    } else {
      dirty += 1;
    }
  }

  return { dirty, conflict };
}

export function resolveSyncStatusFromDrafts(
  drafts: Iterable<CloudRepoDraftRecord>
): CloudRepoSyncStatus {
  let hasDirty = false;

  for (const draft of drafts) {
    if (draft.state === 'conflict') {
      return 'error';
    }
    hasDirty = true;
  }

  return hasDirty ? 'has_changes' : 'synced';
}

export function getSyncStatusForRepository(
  drafts: Iterable<CloudRepoDraftRecord>,
  repositoryId: number
): CloudRepoSyncStatus {
  const repositoryDrafts: CloudRepoDraftRecord[] = [];
  for (const draft of drafts) {
    if (draft.repositoryId === repositoryId) {
      repositoryDrafts.push(draft);
    }
  }
  return resolveSyncStatusFromDrafts(repositoryDrafts);
}
