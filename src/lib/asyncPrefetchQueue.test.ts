import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAsyncPrefetchQueue } from './asyncPrefetchQueue';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('createAsyncPrefetchQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('limits concurrent prefetch tasks', async () => {
    const queue = createAsyncPrefetchQueue(2);
    const gates = [createDeferred(), createDeferred(), createDeferred()];
    let activeCount = 0;
    let maxActiveCount = 0;

    const tasks = gates.map((gate) =>
      queue.run(async () => {
        activeCount += 1;
        maxActiveCount = Math.max(maxActiveCount, activeCount);
        await gate.promise;
        activeCount -= 1;
      })
    );

    await Promise.resolve();
    expect(maxActiveCount).toBe(2);

    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(maxActiveCount).toBe(2);

    gates[1].resolve();
    gates[2].resolve();
    await Promise.all(tasks);
    expect(activeCount).toBe(0);
  });

  it('normalizes invalid concurrency limits so queued tasks still run', async () => {
    const queue = createAsyncPrefetchQueue(0);

    await expect(queue.run(async () => 'ok')).resolves.toBe('ok');
  });

  it('releases queue slots when a prefetch task stalls', async () => {
    vi.useFakeTimers();
    const queue = createAsyncPrefetchQueue(1);
    const stalled = queue.run(() => new Promise<void>(() => {}));
    let secondStarted = false;
    const second = queue.run(async () => {
      secondStarted = true;
    });
    const rejection = expect(stalled).rejects.toThrow('Prefetch task timed out');

    await vi.advanceTimersByTimeAsync(30_000);

    await rejection;
    await second;
    expect(secondStarted).toBe(true);
  });
});
