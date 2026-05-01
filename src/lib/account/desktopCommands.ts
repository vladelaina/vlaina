import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import { getElectronBridge } from '@/lib/electron/bridge';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from './sessionEvent';

type ManagedBridgeDiagnostic = Record<string, unknown>

function logManagedBridgeDiagnostic(event: string, details: ManagedBridgeDiagnostic) {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  if (window.localStorage.getItem('vlaina:debug:managed-bridge') !== '1') {
    return;
  }

  console.info(`[managed bridge] ${event}`, details);
}

function toManagedBridgeIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

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

function shouldInvalidateDesktopSession(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error ?? '');

  return message.trim().toLowerCase() === 'vlaina sign-in required';
}

function dispatchAccountInvalidatedEvent(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));
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
  }> {
    return await getDesktopAccountBridge().getSessionStatus() as {
      connected: boolean;
      provider: AccountProvider | null;
      username: string | null;
      primaryEmail: string | null;
      avatarUrl: string | null;
      membershipTier: MembershipTier | null;
      membershipName: string | null;
    };
  },

  async accountAuth(provider: Exclude<AccountProvider, 'email'>) {
    return await getDesktopAccountBridge().startAuth(provider);
  },

  async cancelAccountAuth() {
    return await getDesktopAccountBridge().cancelAuth?.();
  },

  async getAuthDebugLog() {
    return await getDesktopAccountBridge().getAuthDebugLog();
  },

  async requestEmailAuthCode(email: string) {
    return await getDesktopAccountBridge().requestEmailCode(email);
  },

  async verifyEmailAuthCode(email: string, code: string) {
    return await getDesktopAccountBridge().verifyEmailCode(email, code);
  },

  async getManagedModels() {
    try {
      return await getDesktopAccountBridge().getManagedModels();
    } catch (error) {
      if (shouldInvalidateDesktopSession(error)) {
        dispatchAccountInvalidatedEvent();
      }
      throw error;
    }
  },

  async getManagedBudget() {
    try {
      return await getDesktopAccountBridge().getManagedBudget();
    } catch (error) {
      if (shouldInvalidateDesktopSession(error)) {
        dispatchAccountInvalidatedEvent();
      }
      throw error;
    }
  },

  async managedChatCompletion(body: object) {
    try {
      return await getDesktopAccountBridge().managedChatCompletion(body);
    } catch (error) {
      if (shouldInvalidateDesktopSession(error)) {
        dispatchAccountInvalidatedEvent();
      }
      throw error;
    }
  },

  async managedChatCompletionStream(
    body: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    externalRequestId?: string
  ) {
    const requestId = externalRequestId?.trim() || `managed-${crypto.randomUUID()}`;
    const startedAt = Date.now();
    const bridge = getDesktopAccountBridge();

    logManagedBridgeDiagnostic('stream_prepare', {
      requestId,
      startedAt: toManagedBridgeIso(startedAt),
      signalAborted: signal?.aborted === true,
    });

    return await new Promise<string>(async (resolve, reject) => {
      let chunkCount = 0;
      let lastChunkAt: number | null = null;
      let lastChunkLength = 0;
      let isSettled = false;

      const cleanupCallbacks: Array<() => void> = [];
      const cleanup = () => {
        while (cleanupCallbacks.length > 0) {
          cleanupCallbacks.pop()?.();
        }
      };

      cleanupCallbacks.push(
        bridge.onManagedStreamChunk(requestId, (content) => {
          const now = Date.now();
          chunkCount += 1;
          logManagedBridgeDiagnostic('stream_chunk', {
            requestId,
            chunkIndex: chunkCount,
            at: toManagedBridgeIso(now),
            elapsedMs: now - startedAt,
            sincePreviousChunkMs: lastChunkAt == null ? null : now - lastChunkAt,
            contentLength: content.length,
            deltaLength: Math.max(0, content.length - lastChunkLength),
          });
          lastChunkAt = now;
          lastChunkLength = content.length;
          onChunk(content);
        })
      );

      cleanupCallbacks.push(
        bridge.onManagedStreamDone(requestId, ({ content }) => {
          if (isSettled) return;
          isSettled = true;
          cleanup();
          logManagedBridgeDiagnostic('stream_done', {
            requestId,
            startedAt: toManagedBridgeIso(startedAt),
            finishedAt: toManagedBridgeIso(Date.now()),
            chunkCount,
            contentLength: content.length,
          });
          resolve(content);
        })
      );

      cleanupCallbacks.push(
        bridge.onManagedStreamError(requestId, ({ message }) => {
          if (isSettled) return;
          isSettled = true;
          cleanup();
          if (shouldInvalidateDesktopSession(message)) {
            dispatchAccountInvalidatedEvent();
          }
          reject(new Error(message || 'Managed stream failed'));
        })
      );

      if (signal) {
        const abortHandler = () => {
          void bridge.cancelManagedChatCompletionStream(requestId);
        };
        signal.addEventListener('abort', abortHandler, { once: true });
        cleanupCallbacks.push(() => {
          signal.removeEventListener('abort', abortHandler);
        });
      }

      try {
        await bridge.startManagedChatCompletionStream(requestId, body);
      } catch (error) {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        if (shouldInvalidateDesktopSession(error)) {
          dispatchAccountInvalidatedEvent();
        }
        reject(error);
      }
    });
  },

  async accountDisconnect() {
    await getDesktopAccountBridge().disconnect();
    dispatchAccountInvalidatedEvent();
  },
};
