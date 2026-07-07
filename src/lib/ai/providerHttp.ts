import { getElectronBridge } from '@/lib/electron/bridge';
import { createAbortError, throwIfAborted } from './providerHttpAbort';
import { fetchWithGetRetry, normalizeProviderRequestUrl } from './providerHttpBrowser';
import { normalizeDesktopRequestBody } from './providerHttpBody';
import type { ProviderFetchInit } from './providerHttpTypes';

const MAX_DESKTOP_PROVIDER_RESPONSE_BODY_BYTES = 64 * 1024 * 1024;

export async function providerFetch(url: string, init: ProviderFetchInit): Promise<Response> {
  const safeUrl = normalizeProviderRequestUrl(url);
  const bridge = getElectronBridge();
  if (bridge?.aiProvider) {
    return desktopProviderFetch(safeUrl, init, bridge.aiProvider);
  }

  return fetchWithGetRetry(safeUrl, init);
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
  let rejectStartOnTerminalError: ((error: Error | DOMException) => void) | null = null;
  let terminalError: Error | DOMException | null = null;
  let listenerRegistrationError: unknown = null;
  let didReceiveMetadata = false;
  let responseBytesReceived = 0;

  const cleanup = () => {
    cleanupCallbacks.splice(0).forEach((cleanupCallback) => cleanupCallback());
  };

  const abortRequest = () => {
    if (didSettle) return;
    didSettle = true;
    void aiProvider.cancelRequest(requestId).catch(() => {});
    const abortError = createAbortError();
    terminalError = abortError;
    try {
      streamController?.error(abortError);
    } catch {
    }
    rejectStartOnTerminalError?.(abortError);
    cleanup();
  };

  if (init.signal?.aborted) {
    throw createAbortError();
  }

  init.signal?.addEventListener('abort', abortRequest, { once: true });
  cleanupCallbacks.push(() => init.signal?.removeEventListener('abort', abortRequest));

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      try {
        cleanupCallbacks.push(aiProvider.onRequestChunk(requestId, (chunk) => {
          if (didSettle || init.signal?.aborted) return;
          responseBytesReceived += chunk.length;
          if (responseBytesReceived > MAX_DESKTOP_PROVIDER_RESPONSE_BODY_BYTES) {
            didSettle = true;
            const error = new Error('Desktop AI provider response body is too large.');
            terminalError = error;
            void aiProvider.cancelRequest(requestId).catch(() => {});
            try {
              controller.error(error);
            } catch {
            }
            rejectStartOnTerminalError?.(error);
            cleanup();
            return;
          }
          const bytes = new Uint8Array(chunk);
          try {
            controller.enqueue(bytes);
          } catch {
          }
        }));
        cleanupCallbacks.push(aiProvider.onRequestDone(requestId, () => {
          if (didSettle || init.signal?.aborted) return;
          didSettle = true;
          if (!didReceiveMetadata) {
            terminalError = new Error('AI provider request completed before response metadata was received.');
            rejectStartOnTerminalError?.(terminalError);
          }
          try {
            controller.close();
          } catch {
          }
          cleanup();
        }));
        cleanupCallbacks.push(aiProvider.onRequestError(requestId, (payload) => {
          if (didSettle || init.signal?.aborted) return;
          didSettle = true;
          const error = new Error(payload.message || 'AI provider request failed');
          if (!didReceiveMetadata) {
            terminalError = error;
            rejectStartOnTerminalError?.(error);
          }
          controller.error(error);
          cleanup();
        }));
      } catch (error) {
        didSettle = true;
        listenerRegistrationError = error;
        cleanup();
        controller.error(error);
      }
    },
    cancel() {
      abortRequest();
    },
  });

  try {
    const terminalErrorPromise = new Promise<never>((_, reject) => {
      rejectStartOnTerminalError = reject;
    });
    terminalErrorPromise.catch(() => undefined);
    if (listenerRegistrationError) {
      throw listenerRegistrationError;
    }
    const requestBody = await normalizeDesktopRequestBody(init.body, init.signal);
    if (terminalError) {
      throw terminalError;
    }
    if (didSettle) {
      return await terminalErrorPromise;
    }

    const startRequestPromise = aiProvider.startRequest(requestId, {
      url,
      method: init.method,
      headers: init.headers,
      ...requestBody,
    });
    startRequestPromise.catch(() => undefined);

    const metadata = await Promise.race([startRequestPromise, terminalErrorPromise]);
    throwIfAborted(init.signal);
    didReceiveMetadata = true;
    rejectStartOnTerminalError = null;

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
