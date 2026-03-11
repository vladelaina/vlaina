import { createPersistenceQueue } from '@/lib/storage/persistenceEngine';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { PersistedCloudRepoState } from './types';

const CLOUD_REPO_BASE_DIR = 'cloud-repositories';
const CLOUD_REPO_STATE_DIR = 'repos';

const queues = new Map<number, ReturnType<typeof createPersistenceQueue<PersistedCloudRepoState>>>();
let lifecycleRegistered = false;

async function getRepoStateFilePath(repositoryId: number): Promise<string> {
  const storage = getStorageAdapter();
  const basePath = await storage.getBasePath();
  const dir = await joinPath(basePath, CLOUD_REPO_BASE_DIR, CLOUD_REPO_STATE_DIR);
  await storage.mkdir(dir, true);
  return joinPath(dir, `${repositoryId}.json`);
}

async function writeRepoState(
  repositoryId: number,
  state: PersistedCloudRepoState
): Promise<void> {
  const storage = getStorageAdapter();
  const filePath = await getRepoStateFilePath(repositoryId);
  await storage.writeFile(filePath, JSON.stringify(state), { recursive: true });
}

function getQueue(repositoryId: number) {
  let queue = queues.get(repositoryId);
  if (!queue) {
    queue = createPersistenceQueue<PersistedCloudRepoState>({
      write: (payload) => writeRepoState(repositoryId, payload),
      debounceMs: 180,
      maxWaitMs: 1500,
      onError: (error) => {
        console.error('[CloudRepos] Failed to persist repository state:', error);
      },
    });
    queues.set(repositoryId, queue);
  }
  return queue;
}

function registerPersistenceLifecycle(): void {
  if (lifecycleRegistered || typeof window === 'undefined') {
    return;
  }

  lifecycleRegistered = true;

  const flushInBackground = () => {
    for (const queue of queues.values()) {
      if (!queue.hasPending()) continue;
      void queue.flush();
    }
  };

  window.addEventListener('pagehide', flushInBackground);
  window.addEventListener('beforeunload', flushInBackground);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushInBackground();
    }
  });
}

registerPersistenceLifecycle();

export async function loadCloudRepoState(
  repositoryId: number
): Promise<PersistedCloudRepoState | null> {
  const storage = getStorageAdapter();
  const filePath = await getRepoStateFilePath(repositoryId);
  const exists = await storage.exists(filePath);
  if (!exists) return null;

  try {
    const raw = await storage.readFile(filePath);
    return JSON.parse(raw) as PersistedCloudRepoState;
  } catch (error) {
    console.error('[CloudRepos] Failed to load repository state:', error);
    return null;
  }
}

export function scheduleCloudRepoStateSave(
  repositoryId: number,
  state: PersistedCloudRepoState
): void {
  getQueue(repositoryId).schedule(state);
}

export async function flushCloudRepoState(repositoryId: number): Promise<void> {
  const queue = queues.get(repositoryId);
  if (!queue) return;
  await queue.flush();
}
