export function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

export function raceWithAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  onAbort?: () => void,
): Promise<T> {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    onAbort?.();
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      onAbort?.();
      reject(createAbortError());
    };

    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        resolve(value);
      },
      (error) => {
        cleanup();
        if (signal.aborted) {
          reject(createAbortError());
          return;
        }
        reject(error);
      },
    );
  });
}
