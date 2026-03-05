type TimerHandle = ReturnType<typeof setTimeout>;

export interface PersistenceQueueOptions<T> {
  write: (payload: T) => Promise<void>;
  debounceMs?: number;
  maxWaitMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  onError?: (error: unknown) => void;
  onIdle?: () => void;
}

export interface PersistenceQueue<T> {
  schedule: (
    payload: T,
    options?: {
      debounceMs?: number;
      maxWaitMs?: number;
    }
  ) => void;
  saveNow: (payload: T) => Promise<void>;
  flush: () => Promise<void>;
  cancel: () => void;
  hasPending: () => boolean;
}

function isPositiveNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function createPersistenceQueue<T>(options: PersistenceQueueOptions<T>): PersistenceQueue<T> {
  const defaultDebounceMs = options.debounceMs ?? 120;
  const defaultMaxWaitMs = options.maxWaitMs;
  const retryBaseMs = options.retryBaseMs ?? Math.max(200, defaultDebounceMs);
  const retryMaxMs = options.retryMaxMs ?? 5000;

  let pendingPayload: T | null = null;
  let writing: Promise<void> | null = null;
  let debounceTimer: TimerHandle | null = null;
  let maxWaitTimer: TimerHandle | null = null;
  let consecutiveFailureCount = 0;

  const clearDebounceTimer = () => {
    if (!debounceTimer) return;
    clearTimeout(debounceTimer);
    debounceTimer = null;
  };

  const clearMaxWaitTimer = () => {
    if (!maxWaitTimer) return;
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  };

  const clearTimers = () => {
    clearDebounceTimer();
    clearMaxWaitTimer();
  };

  const notifyIdleIfNeeded = () => {
    if (!options.onIdle) return;
    if (pendingPayload !== null) return;
    if (writing) return;
    if (debounceTimer || maxWaitTimer) return;
    options.onIdle();
  };

  const getRetryDelayMs = () => {
    const exp = Math.max(0, consecutiveFailureCount - 1);
    const delay = retryBaseMs * 2 ** exp;
    return Math.min(retryMaxMs, delay);
  };

  const runEnqueueInBackground = () => {
    void enqueueWrite().catch(() => {
      // Fire-and-forget callers rely on onError callbacks.
    });
  };

  const enqueueWrite = (): Promise<void> => {
    if (writing) return writing;
    if (pendingPayload === null) {
      notifyIdleIfNeeded();
      return Promise.resolve();
    }

    writing = (async () => {
      while (pendingPayload !== null) {
        const payload = pendingPayload;
        pendingPayload = null;
        try {
          await options.write(payload);
          consecutiveFailureCount = 0;
        } catch (error) {
          consecutiveFailureCount += 1;
          pendingPayload = pendingPayload ?? payload;
          throw error;
        }
      }
    })().catch((error) => {
      options.onError?.(error);
      throw error;
    }).finally(() => {
        writing = null;
        if (pendingPayload !== null) {
          const delayMs =
            consecutiveFailureCount > 0
              ? getRetryDelayMs()
              : isPositiveNumber(defaultDebounceMs)
                ? defaultDebounceMs
                : 0;

          if (isPositiveNumber(delayMs)) {
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              runEnqueueInBackground();
            }, delayMs);
          } else {
            runEnqueueInBackground();
          }
          return;
        }
        notifyIdleIfNeeded();
      });

    return writing;
  };

  const schedule: PersistenceQueue<T>['schedule'] = (payload, runtimeOptions) => {
    pendingPayload = payload;

    const debounceMs = runtimeOptions?.debounceMs ?? defaultDebounceMs;
    const maxWaitMs = runtimeOptions?.maxWaitMs ?? defaultMaxWaitMs;

    clearDebounceTimer();
    if (isPositiveNumber(debounceMs)) {
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        clearMaxWaitTimer();
        runEnqueueInBackground();
      }, debounceMs);
    } else {
      runEnqueueInBackground();
    }

    if (isPositiveNumber(maxWaitMs)) {
      if (!maxWaitTimer) {
        maxWaitTimer = setTimeout(() => {
          maxWaitTimer = null;
          clearDebounceTimer();
          runEnqueueInBackground();
        }, maxWaitMs);
      }
    } else {
      clearMaxWaitTimer();
    }
  };

  const flush: PersistenceQueue<T>['flush'] = async () => {
    clearTimers();
    if (pendingPayload === null && !writing) {
      notifyIdleIfNeeded();
      return;
    }

    await enqueueWrite();
    if (writing) {
      await writing;
    }
    notifyIdleIfNeeded();
  };

  return {
    schedule,
    saveNow: async (payload: T) => {
      pendingPayload = payload;
      await flush();
    },
    flush,
    cancel: () => {
      pendingPayload = null;
      clearTimers();
      notifyIdleIfNeeded();
    },
    hasPending: () => pendingPayload !== null || writing !== null || debounceTimer !== null || maxWaitTimer !== null,
  };
}
