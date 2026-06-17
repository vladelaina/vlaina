import { MAX_INLINE_IMAGE_BYTES } from '@/lib/markdown/dataImagePolicy';
import { toBlobPart } from '@/lib/blobPart';

export const MAX_FETCHED_IMAGE_BYTES = MAX_INLINE_IMAGE_BYTES;

export type BoundedImageBlobFetchResult =
  | { status: 'ok'; blob: Blob }
  | { status: 'too-large'; blob: null };

interface FetchBoundedImageBlobOptions {
  maxBytes?: number;
  fetchInit?: RequestInit;
  signal?: AbortSignal;
}

export function createSafeImageFetchInit(fetchInit?: RequestInit, signal?: AbortSignal): RequestInit {
  const init: RequestInit = { ...(fetchInit ?? {}) };
  const effectiveSignal = signal ?? fetchInit?.signal;
  if (effectiveSignal) {
    init.signal = effectiveSignal;
  }
  init.credentials = 'omit';
  init.referrerPolicy = 'no-referrer';
  init.redirect = 'error';
  return init;
}

function getMaxBytes(options: FetchBoundedImageBlobOptions | undefined): number {
  const maxBytes = options?.maxBytes;
  return typeof maxBytes === 'number' && Number.isFinite(maxBytes) && maxBytes >= 0
    ? maxBytes
    : MAX_FETCHED_IMAGE_BYTES;
}

function readContentLength(response: Response): number | null {
  const raw = response.headers?.get?.('content-length');
  if (!raw || raw.length > 32 || !/^\d+$/.test(raw)) {
    return null;
  }

  const size = Number.parseInt(raw, 10);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

function isByteLengthWithinLimit(size: number, maxBytes: number): boolean {
  return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
  }
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function getAbortSignal(options: FetchBoundedImageBlobOptions | undefined): AbortSignal | undefined {
  return options?.signal ?? options?.fetchInit?.signal ?? undefined;
}

function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) {
    return promise;
  }
  throwIfAborted(signal);
  promise.catch(() => undefined);

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

async function readResponseStreamBlob(
  response: Response,
  maxBytes: number,
  contentLength: number | null,
  signal?: AbortSignal,
): Promise<Blob | null> {
  throwIfAborted(signal);
  const reader = response.body?.getReader();
  if (!reader) {
    if (contentLength === null) {
      return null;
    }

    const blob = await raceWithAbort(response.blob(), signal);
    throwIfAborted(signal);
    return isByteLengthWithinLimit(blob.size, maxBytes) ? blob : null;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => undefined);
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal);
      throwIfAborted(signal);
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError();
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }

  return new Blob(chunks.map(toBlobPart), {
    type: response.headers?.get?.('content-type') || '',
  });
}

export async function fetchBoundedImageBlobResult(
  src: string,
  options?: FetchBoundedImageBlobOptions,
): Promise<BoundedImageBlobFetchResult> {
  const response = await fetch(src, createSafeImageFetchInit(options?.fetchInit, options?.signal));
  return readBoundedImageBlobResponse(response, options);
}

export async function readBoundedImageBlobResponse(
  response: Response,
  options?: Pick<FetchBoundedImageBlobOptions, 'maxBytes' | 'signal'>,
): Promise<BoundedImageBlobFetchResult> {
  const maxBytes = getMaxBytes(options);
  const signal = getAbortSignal(options);
  throwIfAborted(signal);
  const contentLength = readContentLength(response);
  if (contentLength !== null && contentLength > maxBytes) {
    await cancelResponseBody(response);
    return { status: 'too-large', blob: null };
  }

  const blob = await readResponseStreamBlob(response, maxBytes, contentLength, signal);
  if (!blob || !isByteLengthWithinLimit(blob.size, maxBytes)) {
    return { status: 'too-large', blob: null };
  }

  return { status: 'ok', blob };
}

export async function fetchBoundedImageBlob(src: string, options?: FetchBoundedImageBlobOptions): Promise<Blob | null> {
  const result = await fetchBoundedImageBlobResult(src, options);
  return result.status === 'ok' ? result.blob : null;
}
