import { createBoundedAsyncQueue } from './boundedAsyncQueue';

const PREFETCH_TASK_TIMEOUT_MS = 30_000;

export function createAsyncPrefetchQueue(limit: number) {
  const queue = createBoundedAsyncQueue({
    concurrency: Number.isFinite(limit) ? limit : 1,
    createAbortError: () => new Error('Prefetch task aborted'),
    createTimeoutError: () => new Error('Prefetch task timed out'),
    timeoutMs: PREFETCH_TASK_TIMEOUT_MS,
  });

  return {
    run: <T>(task: () => Promise<T>): Promise<T> => queue.run(task),
  };
}
