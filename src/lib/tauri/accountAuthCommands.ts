import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import { isTauri } from '@/lib/storage/adapter';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from './webAccountSession';
import { safeInvoke } from './invoke';
import { listen } from '@tauri-apps/api/event';

type ManagedBridgeDiagnostic = Record<string, unknown>

function getManagedBridgeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error.trim();
  }

  if (error instanceof Error) {
    return error.message.trim();
  }

  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message.trim();
  }

  return String(error ?? '').trim();
}

function summarizeManagedBridgeError(error: unknown): ManagedBridgeDiagnostic {
  const message = getManagedBridgeErrorMessage(error);

  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: message,
      errorStackPreview: error.stack?.split('\n').slice(0, 3).join(' | ') ?? null,
      isAbort: error.name === 'AbortError',
    };
  }

  if (error && typeof error === 'object') {
    return {
      errorName: null,
      errorMessage: message,
      errorKeys: Object.keys(error as Record<string, unknown>).slice(0, 8),
      isAbort: message.toLowerCase().includes('abort'),
    };
  }

  return {
    errorName: null,
    errorMessage: message,
    errorStackPreview: null,
    isAbort: message.toLowerCase().includes('abort'),
  };
}

function toManagedBridgeIso(value: number): string {
  return new Date(value).toISOString();
}

function logManagedBridgeDiagnostic(event: string, details: ManagedBridgeDiagnostic): void {
  void event;
  void details;
}

let accountAuthInvalidationBridgeRegistered = false;

function registerAccountAuthInvalidationBridge(): void {
  if (accountAuthInvalidationBridgeRegistered || !isTauri() || typeof window === 'undefined') {
    return;
  }

  accountAuthInvalidationBridgeRegistered = true;
  void listen(ACCOUNT_AUTH_INVALIDATED_EVENT, () => {
    window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));
  }).catch(() => {
    accountAuthInvalidationBridgeRegistered = false;
  });
}

registerAccountAuthInvalidationBridge();

export const accountCommands = {
  async getAccountSessionStatus() {
    return safeInvoke<{
      connected: boolean;
      provider: AccountProvider | null;
      username: string | null;
      primaryEmail: string | null;
      avatarUrl: string | null;
      membershipTier: MembershipTier | null;
      membershipName: string | null;
    }>('get_account_session_status', undefined, {
      webFallback: {
        connected: false,
        provider: null,
        username: null,
        primaryEmail: null,
        avatarUrl: null,
        membershipTier: null,
        membershipName: null,
      },
    });
  },

  async accountAuth(provider: Exclude<AccountProvider, 'email'>) {
    return safeInvoke<{
      success: boolean;
      provider: AccountProvider | null;
      username: string | null;
      primaryEmail: string | null;
      avatarUrl: string | null;
      error: string | null;
    }>('account_auth', { provider }, {
      webFallback: {
        success: false,
        provider: null,
        username: null,
        primaryEmail: null,
        avatarUrl: null,
        error: 'Desktop account sign-in is not available on web platform',
      },
    });
  },

  async requestEmailAuthCode(email: string) {
    return (await safeInvoke<boolean>('request_email_auth_code', { email }, {
      webFallback: false,
    })) ?? false;
  },

  async verifyEmailAuthCode(email: string, code: string) {
    return safeInvoke<{
      success: boolean;
      provider: AccountProvider | null;
      username: string | null;
      primaryEmail: string | null;
      avatarUrl: string | null;
      error: string | null;
    }>('verify_email_auth_code', { email, code }, {
      webFallback: {
        success: false,
        provider: null,
        username: null,
        primaryEmail: null,
        avatarUrl: null,
        error: 'Desktop email sign-in is not available on web platform',
      },
    });
  },

  async getManagedModels() {
    return safeInvoke<Record<string, unknown>>('get_managed_models', undefined, {
      webFallback: { data: [] },
    });
  },

  async getManagedBudget() {
    return safeInvoke<Record<string, unknown>>('get_managed_budget', undefined, {
      webFallback: {
        active: false,
        usedPercent: 0,
        remainingPercent: 0,
        status: 'inactive',
      },
    });
  },

  async managedChatCompletion(body: object) {
    return safeInvoke<Record<string, unknown>>('managed_chat_completion', { body }, {
      webFallback: {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '',
            },
          },
        ],
      },
    });
  },

  async managedChatCompletionStream(
    body: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    externalRequestId?: string
  ) {
    const requestId = externalRequestId?.trim() || `managed-${crypto.randomUUID()}`;
    const chunkEvent = `managed-chat-stream:${requestId}:chunk`;
    const doneEvent = `managed-chat-stream:${requestId}:done`;
    const errorEvent = `managed-chat-stream:${requestId}:error`;
    const startedAt = Date.now();

    let fullContent = '';
    let chunkCount = 0;
    let lastChunkAt: number | null = null;
    let lastChunkLength = 0;

    logManagedBridgeDiagnostic('stream_prepare', {
      requestId,
      startedAt: toManagedBridgeIso(startedAt),
      signalAborted: signal?.aborted === true,
      chunkEvent,
      doneEvent,
      errorEvent,
    });

    return await new Promise<string>(async (resolve, reject) => {
      const cleanupCallbacks: Array<() => void> = [];
      const cleanup = () => {
        while (cleanupCallbacks.length > 0) {
          const dispose = cleanupCallbacks.pop();
          try {
            dispose?.();
          } catch {
          }
        }
      };

      const abortHandler = () => {
        const abortedAt = Date.now();
        logManagedBridgeDiagnostic('stream_abort', {
          requestId,
          startedAt: toManagedBridgeIso(startedAt),
          abortedAt: toManagedBridgeIso(abortedAt),
          durationMs: abortedAt - startedAt,
          chunkCount,
          contentLength: fullContent.length,
        });
        cleanup();
        reject(new DOMException('The operation was aborted', 'AbortError'));
      };

      if (signal) {
        if (signal.aborted) {
          logManagedBridgeDiagnostic('stream_abort_before_start', {
            requestId,
            startedAt: toManagedBridgeIso(startedAt),
          });
          abortHandler();
          return;
        }
        signal.addEventListener('abort', abortHandler, { once: true });
        cleanupCallbacks.push(() => signal.removeEventListener('abort', abortHandler));
      }

      try {
        const unlistenChunk = await listen<string>(chunkEvent, (event) => {
          if (typeof event.payload !== 'string') {
            logManagedBridgeDiagnostic('stream_chunk_ignored', {
              requestId,
              payloadType: typeof event.payload,
            });
            return;
          }
          const now = Date.now();
          chunkCount += 1;
          logManagedBridgeDiagnostic('stream_chunk', {
            requestId,
            chunkIndex: chunkCount,
            at: toManagedBridgeIso(now),
            elapsedMs: now - startedAt,
            sincePreviousChunkMs: lastChunkAt == null ? null : now - lastChunkAt,
            contentLength: event.payload.length,
            deltaLength: Math.max(0, event.payload.length - lastChunkLength),
          });
          fullContent = event.payload;
          lastChunkAt = now;
          lastChunkLength = event.payload.length;
          onChunk(fullContent);
        });
        cleanupCallbacks.push(unlistenChunk);

        const unlistenDone = await listen<string | null>(doneEvent, (event) => {
          const now = Date.now();
          if (typeof event.payload === 'string') {
            fullContent = event.payload;
          }
          logManagedBridgeDiagnostic('stream_done', {
            requestId,
            startedAt: toManagedBridgeIso(startedAt),
            finishedAt: toManagedBridgeIso(now),
            durationMs: now - startedAt,
            chunkCount,
            contentLength: fullContent.length,
            payloadType: event.payload == null ? 'null' : typeof event.payload,
          });
          cleanup();
          resolve(fullContent);
        });
        cleanupCallbacks.push(unlistenDone);

        const unlistenError = await listen<string>(errorEvent, (event) => {
          const now = Date.now();
          logManagedBridgeDiagnostic('stream_error_event', {
            requestId,
            startedAt: toManagedBridgeIso(startedAt),
            failedAt: toManagedBridgeIso(now),
            durationMs: now - startedAt,
            chunkCount,
            contentLength: fullContent.length,
            errorMessage: typeof event.payload === 'string' ? event.payload : 'Managed stream failed',
          });
          cleanup();
          reject(new Error(typeof event.payload === 'string' ? event.payload : 'Managed stream failed'));
        });
        cleanupCallbacks.push(unlistenError);

        logManagedBridgeDiagnostic('stream_listeners_ready', {
          requestId,
          startedAt: toManagedBridgeIso(startedAt),
        });

        logManagedBridgeDiagnostic('stream_invoke_start', {
          requestId,
          startedAt: toManagedBridgeIso(startedAt),
        });
        await safeInvoke('managed_chat_completion_stream', {
          requestId,
          body,
        }, {
          webFallback: undefined,
          throwOnWeb: true,
        });
        logManagedBridgeDiagnostic('stream_invoke_ready', {
          requestId,
          startedAt: toManagedBridgeIso(startedAt),
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        const failedAt = Date.now();
        logManagedBridgeDiagnostic('stream_invoke_error', {
          requestId,
          startedAt: toManagedBridgeIso(startedAt),
          failedAt: toManagedBridgeIso(failedAt),
          durationMs: failedAt - startedAt,
          chunkCount,
          contentLength: fullContent.length,
          ...summarizeManagedBridgeError(error),
        });
        cleanup();
        reject(error);
      }
    });
  },

  async accountDisconnect() {
    return safeInvoke('account_disconnect');
  },
};
