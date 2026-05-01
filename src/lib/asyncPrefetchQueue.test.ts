import { describe, expect, it } from 'vitest';
import { createAsyncPrefetchQueue } from './asyncPrefetchQueue';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('createAsyncPrefetchQueue', () => {
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
});
