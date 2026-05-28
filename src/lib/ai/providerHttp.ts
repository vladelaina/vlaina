import { getElectronBridge } from '@/lib/electron/bridge';

interface ProviderFetchInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: BodyInit | null;
  signal?: AbortSignal;
}

const PROVIDER_GET_RETRY_DELAYS_MS = [300];
const PROVIDER_FAST_FAILURE_RETRY_WINDOW_MS = 2000;

export async function providerFetch(url: string, init: ProviderFetchInit): Promise<Response> {
  const bridge = getElectronBridge();
  if (bridge?.aiProvider) {
    return desktopProviderFetch(url, init, bridge.aiProvider);
  }

  return fetchWithGetRetry(url, init);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function delayProviderRetry(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const complete = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    signal?.addEventListener('abort', abort, { once: true });
    timeout = setTimeout(complete, ms);
  });
}

async function fetchWithGetRetry(url: string, init: ProviderFetchInit): Promise<Response> {
  const shouldRetry = init.method === 'GET';
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      return await fetch(url, init);
    } catch (error) {
      const retryDelayMs = shouldRetry ? PROVIDER_GET_RETRY_DELAYS_MS[attempt] : undefined;
      const failedQuickly = Date.now() - startedAt <= PROVIDER_FAST_FAILURE_RETRY_WINDOW_MS;
      if (isAbortError(error) || init.signal?.aborted || retryDelayMs == null || !failedQuickly) {
        throw error;
      }
      await delayProviderRetry(retryDelayMs, init.signal);
    }
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function normalizeDesktopRequestBody(body: BodyInit | null | undefined): Promise<{
  body?: string;
  bodyBase64?: string;
}> {
  if (body == null) {
    return {};
  }
  if (typeof body === 'string') {
    return { body };
  }
  if (body instanceof Blob) {
    return { bodyBase64: bytesToBase64(new Uint8Array(await body.arrayBuffer())) };
  }
  if (body instanceof ArrayBuffer) {
    return { bodyBase64: bytesToBase64(new Uint8Array(body)) };
  }
  if (ArrayBuffer.isView(body)) {
    return { bodyBase64: bytesToBase64(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)) };
  }
  throw new Error('Unsupported desktop AI provider request body.');
}

async function desktopProviderFetch(
  url: string,
  init: ProviderFetchInit,
  aiProvider: NonNullable<ReturnType<typeof getElectronBridge>>['aiProvider']
): Promise<Response> {
  const requestId = createRequestId();
  const cleanupCallbacks: Array<() => void> = [];
  let didSettle = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  let rejectStartOnAbort: ((error: DOMException) => void) | null = null;

  const cleanup = () => {
    cleanupCallbacks.splice(0).forEach((cleanupCallback) => cleanupCallback());
  };

  const abortRequest = () => {
    if (didSettle) return;
    didSettle = true;
    void aiProvider.cancelRequest(requestId).catch(() => {});
    const abortError = new DOMException('Aborted', 'AbortError');
    try {
      streamController?.error(abortError);
    } catch {
    }
    rejectStartOnAbort?.(abortError);
    cleanup();
  };

  if (init.signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  init.signal?.addEventListener('abort', abortRequest, { once: true });
  cleanupCallbacks.push(() => init.signal?.removeEventListener('abort', abortRequest));

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      cleanupCallbacks.push(
        aiProvider.onRequestChunk(requestId, (chunk) => {
          const bytes = new Uint8Array(chunk);
          controller.enqueue(bytes);
        }),
        aiProvider.onRequestDone(requestId, () => {
          didSettle = true;
          controller.close();
          cleanup();
        }),
        aiProvider.onRequestError(requestId, (payload) => {
          didSettle = true;
          controller.error(new Error(payload.message || 'AI provider request failed'));
          cleanup();
        })
      );
    },
    cancel() {
      abortRequest();
    },
  });

  try {
    const abortPromise = new Promise<never>((_, reject) => {
      rejectStartOnAbort = reject;
    });
    const requestBody = await normalizeDesktopRequestBody(init.body);
    if (didSettle) {
      return await abortPromise;
    }

    const startRequestPromise = aiProvider.startRequest(requestId, {
      url,
      method: init.method,
      headers: init.headers,
      ...requestBody,
    });
    startRequestPromise.catch(() => undefined);

    const metadata = await Promise.race([startRequestPromise, abortPromise]);
    rejectStartOnAbort = null;

    return new Response(body, {
      status: metadata.status,
      statusText: metadata.statusText,
      headers: new Headers(metadata.headers),
    });
  } catch (error) {
    didSettle = true;
    cleanup();
    throw error;
  }
}

function createRequestId(): string {
  return `provider-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
