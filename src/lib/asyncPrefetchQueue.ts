export function createAsyncPrefetchQueue(limit: number) {
  const concurrency = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (activeCount >= concurrency) {
      return;
    }

    const next = queue.shift();
    next?.();
  };

  return {
    run: <T>(task: () => Promise<T>): Promise<T> =>
      new Promise((resolve, reject) => {
        const start = () => {
          activeCount += 1;
          task()
            .then(resolve, reject)
            .finally(() => {
              activeCount -= 1;
              runNext();
            });
        };

        if (activeCount < concurrency) {
          start();
          return;
        }

        queue.push(start);
      }),
  };
}
