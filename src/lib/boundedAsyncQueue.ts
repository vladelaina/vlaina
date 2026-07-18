interface BoundedAsyncQueueOptions {
  concurrency: number;
  createAbortError: () => Error;
  createTimeoutError: () => Error;
  timeoutMs: number;
}

interface ScheduledTask {
  start: () => void;
}

function runBoundedTask<T>(
  task: () => Promise<T>,
  signal: AbortSignal | undefined,
  options: BoundedAsyncQueueOptions,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let handleAbort: (() => void) | null = null;
  let taskPromise: Promise<T>;
  try {
    taskPromise = Promise.resolve(task());
  } catch (error) {
    taskPromise = Promise.reject(error);
  }
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(options.createTimeoutError()), options.timeoutMs);
  });
  const aborted = signal
    ? new Promise<never>((_resolve, reject) => {
        handleAbort = () => reject(options.createAbortError());
        signal.addEventListener('abort', handleAbort, { once: true });
        if (signal.aborted) {
          handleAbort();
        }
      })
    : null;

  return Promise.race([
    taskPromise,
    timeout,
    ...(aborted ? [aborted] : []),
  ]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    if (handleAbort) {
      signal?.removeEventListener('abort', handleAbort);
    }
  });
}

export function createBoundedAsyncQueue(options: BoundedAsyncQueueOptions) {
  const concurrency = Math.max(1, Math.floor(options.concurrency));
  const pending: ScheduledTask[] = [];
  let activeCount = 0;

  const drain = () => {
    while (activeCount < concurrency) {
      const scheduled = pending.shift();
      if (!scheduled) return;
      scheduled.start();
    }
  };

  return {
    run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) {
        return Promise.reject(options.createAbortError());
      }

      return new Promise<T>((resolve, reject) => {
        let started = false;
        let abortPending: (() => void) | null = null;
        const scheduled: ScheduledTask = {
          start: () => {
            started = true;
            if (abortPending) {
              signal?.removeEventListener('abort', abortPending);
            }
            activeCount += 1;
            void runBoundedTask(task, signal, options)
              .then(resolve, reject)
              .finally(() => {
                activeCount -= 1;
                drain();
              });
          },
        };

        abortPending = () => {
          if (started) return;
          const index = pending.indexOf(scheduled);
          if (index === -1) return;
          pending.splice(index, 1);
          reject(options.createAbortError());
        };
        signal?.addEventListener('abort', abortPending, { once: true });

        if (activeCount < concurrency) {
          scheduled.start();
        } else {
          pending.push(scheduled);
        }
      });
    },
  };
}
