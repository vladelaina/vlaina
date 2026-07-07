const MAX_MANAGED_DESKTOP_BINARY_BODY_BYTES = 64 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function assertManagedDesktopBinaryBodySize(byteLength: number): void {
  if (!Number.isFinite(byteLength) || byteLength < 0 || byteLength > MAX_MANAGED_DESKTOP_BINARY_BODY_BYTES) {
    throw new Error('Managed desktop binary request body is too large.');
  }
}

export function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function raceWithAbort<T>(
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

function readBlobAsArrayBuffer(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  const arrayBuffer = (blob as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer;
  if (typeof arrayBuffer === 'function') {
    return raceWithAbort(arrayBuffer.call(blob), signal);
  }

  if (typeof FileReader === 'undefined') {
    return Promise.reject(new Error('Managed desktop binary requests require Blob.arrayBuffer or FileReader support.'));
  }

  const reader = new FileReader();
  const promise = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error('Managed desktop binary request body could not be read as bytes.'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Managed desktop binary request body could not be read.'));
    };
    reader.onabort = () => {
      reject(createAbortError());
    };
    reader.readAsArrayBuffer(blob);
  });
  return raceWithAbort(promise, signal, () => {
    try {
      reader.abort();
    } catch {
    }
  });
}

export async function serializeBinaryBodyForDesktop(body: BodyInit, headers: Record<string, string>, signal?: AbortSignal): Promise<{
  bodyBase64: string;
  headers: Record<string, string>;
}> {
  throwIfAborted(signal);
  if (!(body instanceof Blob)) {
    throw new Error('Managed desktop binary requests require a Blob body.');
  }

  assertManagedDesktopBinaryBodySize(body.size);
  const bytes = new Uint8Array(await readBlobAsArrayBuffer(body, signal));
  assertManagedDesktopBinaryBodySize(bytes.byteLength);
  return {
    bodyBase64: bytesToBase64(bytes),
    headers,
  };
}

export function publicManagedStreamErrorMessage(message: string | undefined, errorCode: string | undefined): string {
  const normalizedCode = typeof errorCode === 'string' ? errorCode.trim().toLowerCase() : '';
  switch (normalizedCode) {
    case 'points_exhausted':
    case 'inactive_points':
    case 'insufficient_points':
      return 'MANAGED_QUOTA_EXHAUSTED';
    case 'upstream_rate_limited':
      return 'UPSTREAM_RATE_LIMITED';
    case 'upstream_unavailable':
      return 'UPSTREAM_UNAVAILABLE';
    case 'invalid_request':
      return 'INVALID_REQUEST';
    default:
      return message || 'Managed stream failed';
  }
}

export async function runCancellableManagedJsonRequest<T>({
  signal,
  requestIdPrefix,
  start,
  cancel,
}: {
  signal?: AbortSignal;
  requestIdPrefix: string;
  start: (requestId?: string) => Promise<T>;
  cancel: (requestId: string) => Promise<void>;
}): Promise<T> {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (!signal) {
    return await start();
  }

  const requestId = `${requestIdPrefix}-${crypto.randomUUID()}`;
  return await new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settleRejected = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => {
      if (settled) return;
      void cancel(requestId).catch(() => {});
      settleRejected(createAbortError());
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    try {
      start(requestId).then(
        (value) => {
          if (settled) return;
          if (signal.aborted) {
            abort();
            return;
          }
          settled = true;
          cleanup();
          resolve(value);
        },
        settleRejected,
      );
    } catch (error) {
      settleRejected(error);
    }
  });
}
