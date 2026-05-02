export function createAsyncPrefetchQueue(limit: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (activeCount >= limit) {
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

        if (activeCount < limit) {
          start();
          return;
        }

        queue.push(start);
      }),
  };
}
