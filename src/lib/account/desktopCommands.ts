import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import type { ManagedBudgetPayload } from '@/lib/ai/managed/types';
import { getElectronBridge } from '@/lib/electron/bridge';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from './sessionEvent';

let accountAuthInvalidationBridgeRegistered = false;

function registerAccountAuthInvalidationBridge(): void {
  if (accountAuthInvalidationBridgeRegistered || typeof window === 'undefined') {
    return;
  }

  accountAuthInvalidationBridgeRegistered = true;
  window.addEventListener(ACCOUNT_AUTH_INVALIDATED_EVENT, () => {
    accountAuthInvalidationBridgeRegistered = false;
  }, { once: true });
}

registerAccountAuthInvalidationBridge();

function getDesktopAccountBridge() {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron desktop bridge is not available.');
  }

  return bridge.account;
}

function dispatchAccountInvalidatedEvent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  return window.btoa(binary);
}

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal?: AbortSignal): void {
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

async function serializeBinaryBodyForDesktop(body: BodyInit, headers: Record<string, string>, signal?: AbortSignal): Promise<{
  bodyBase64: string;
  headers: Record<string, string>;
}> {
  throwIfAborted(signal);
  if (!(body instanceof Blob)) {
    throw new Error('Managed desktop binary requests require a Blob body.');
  }

  return {
    bodyBase64: bytesToBase64(new Uint8Array(await readBlobAsArrayBuffer(body, signal))),
    headers,
  };
}

function publicManagedStreamErrorMessage(message: string | undefined, errorCode: string | undefined): string {
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

async function runCancellableManagedJsonRequest<T>({
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

export const accountCommands = {
  async getAccountSessionStatus(): Promise<{
    connected: boolean;
    provider: AccountProvider | null;
    username: string | null;
    primaryEmail: string | null;
    avatarUrl: string | null;
    membershipTier: MembershipTier | null;
    membershipName: string | null;
    sessionInvalidated?: boolean;
    persistent?: boolean;
    budget?: ManagedBudgetPayload | null;
  }> {
    return await getDesktopAccountBridge().getSessionStatus() as {
      connected: boolean;
      provider: AccountProvider | null;
      username: string | null;
      primaryEmail: string | null;
      avatarUrl: string | null;
      membershipTier: MembershipTier | null;
      membershipName: string | null;
      sessionInvalidated?: boolean;
      persistent?: boolean;
      budget?: ManagedBudgetPayload | null;
    };
  },

  async accountAuth(provider: Exclude<AccountProvider, 'email'>) {
    return await getDesktopAccountBridge().startAuth(provider);
  },

  async cancelAccountAuth() {
    return await getDesktopAccountBridge().cancelAuth?.();
  },

  async requestEmailAuthCode(email: string) {
    return await getDesktopAccountBridge().requestEmailCode(email);
  },

  async verifyEmailAuthCode(email: string, code: string) {
    return await getDesktopAccountBridge().verifyEmailCode(email, code);
  },

  async getManagedModels() {
    return await getDesktopAccountBridge().getManagedModels();
  },

  async getManagedModelsVersion() {
    return await getDesktopAccountBridge().getManagedModelsVersion();
  },

  async getManagedBudget() {
    return await getDesktopAccountBridge().getManagedBudget();
  },

  async managedChatCompletion(body: object, signal?: AbortSignal) {
    const bridge = getDesktopAccountBridge();
    return await runCancellableManagedJsonRequest({
      signal,
      requestIdPrefix: 'managed-json',
      start: (requestId) => bridge.managedChatCompletion(body, requestId),
      cancel: (requestId) => bridge.cancelManagedChatCompletion(requestId),
    });
  },

  async managedImageGeneration(body: object, signal?: AbortSignal) {
    const bridge = getDesktopAccountBridge();
    return await runCancellableManagedJsonRequest({
      signal,
      requestIdPrefix: 'managed-image-generation',
      start: (requestId) => bridge.managedImageGeneration(body, requestId),
      cancel: (requestId) => bridge.cancelManagedImageGeneration(requestId),
    });
  },

  async managedImageEdit(body: BodyInit, headers: Record<string, string>, signal?: AbortSignal) {
    const payload = await serializeBinaryBodyForDesktop(body, headers, signal);
    throwIfAborted(signal);
    const bridge = getDesktopAccountBridge();
    return await runCancellableManagedJsonRequest({
      signal,
      requestIdPrefix: 'managed-image-edit',
      start: (requestId) => bridge.managedImageEdit(payload, requestId),
      cancel: (requestId) => bridge.cancelManagedImageEdit(requestId),
    });
  },

  async managedChatCompletionStream(
    body: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    externalRequestId?: string
  ) {
    const requestId = externalRequestId?.trim() || `managed-${crypto.randomUUID()}`;
    const bridge = getDesktopAccountBridge();
    if (signal?.aborted) {
      void bridge.cancelManagedChatCompletionStream(requestId);
      throw createAbortError();
    }

    return await new Promise<string>((resolve, reject) => {
      let isSettled = false;

      const cleanupCallbacks: Array<() => void> = [];
      const cleanup = () => {
        while (cleanupCallbacks.length > 0) {
          cleanupCallbacks.pop()?.();
        }
      };
      const addCleanupCallback = (cleanupCallback: () => void) => {
        if (isSettled) {
          cleanupCallback();
          return;
        }
        cleanupCallbacks.push(cleanupCallback);
      };
      const settleRejected = (error: unknown) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(error);
      };
      const settleAborted = () => {
        void bridge.cancelManagedChatCompletionStream(requestId);
        settleRejected(new DOMException('Aborted', 'AbortError'));
      };

      try {
        addCleanupCallback(
          bridge.onManagedStreamChunk(requestId, (content) => {
            if (isSettled) return;
            try {
              throwIfAborted(signal);
              onChunk(content);
              throwIfAborted(signal);
            } catch (error) {
              if (signal?.aborted) {
                settleAborted();
                return;
              }
              settleRejected(error);
            }
          })
        );
        if (isSettled) return;

        addCleanupCallback(
          bridge.onManagedStreamDone(requestId, ({ content }) => {
            if (isSettled) return;
            if (signal?.aborted) {
              settleAborted();
              return;
            }
            isSettled = true;
            cleanup();
            resolve(content);
          })
        );
        if (isSettled) return;

        addCleanupCallback(
          bridge.onManagedStreamError(requestId, ({ message, statusCode, errorCode }) => {
            if (isSettled) return;
            if (signal?.aborted) {
              settleAborted();
              return;
            }
            const error = new Error(publicManagedStreamErrorMessage(message, errorCode)) as Error & {
              statusCode?: number;
              errorCode?: string;
            };
            if (typeof statusCode === 'number') {
              error.statusCode = statusCode;
            }
            if (typeof errorCode === 'string' && errorCode.trim()) {
              error.errorCode = errorCode.trim();
            }
            settleRejected(error);
          })
        );
      } catch (error) {
        settleRejected(error);
        return;
      }

      if (signal?.aborted) {
        settleAborted();
        return;
      }

      if (signal) {
        const abortHandler = () => {
          settleAborted();
        };
        signal.addEventListener('abort', abortHandler, { once: true });
        addCleanupCallback(() => {
          signal.removeEventListener('abort', abortHandler);
        });
      }

      try {
        void Promise.resolve(bridge.startManagedChatCompletionStream(requestId, body))
          .catch(settleRejected);
      } catch (error) {
        settleRejected(error);
      }
    });
  },

  async accountDisconnect() {
    await getDesktopAccountBridge().disconnect();
    dispatchAccountInvalidatedEvent();
  },
};
