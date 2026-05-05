import { getElectronBridge } from '@/lib/electron/bridge';

interface ProviderFetchInit {
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export async function providerFetch(url: string, init: ProviderFetchInit): Promise<Response> {
  const bridge = getElectronBridge();
  if (bridge?.aiProvider) {
    return desktopProviderFetch(url, init, bridge.aiProvider);
  }

  return fetch(url, init);
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

  const cleanup = () => {
    cleanupCallbacks.splice(0).forEach((cleanupCallback) => cleanupCallback());
  };

  const abortRequest = () => {
    if (didSettle) return;
    void aiProvider.cancelRequest(requestId).catch(() => {});
    streamController?.error(new DOMException('Aborted', 'AbortError'));
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
    const metadata = await aiProvider.startRequest(requestId, {
      url,
      method: init.method,
      headers: init.headers,
      body: init.body,
    });

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
