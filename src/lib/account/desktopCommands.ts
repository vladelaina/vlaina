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

  async managedChatCompletion(body: object) {
    return await getDesktopAccountBridge().managedChatCompletion(body);
  },

  async managedChatCompletionStream(
    body: Record<string, unknown>,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    externalRequestId?: string
  ) {
    const requestId = externalRequestId?.trim() || `managed-${crypto.randomUUID()}`;
    const bridge = getDesktopAccountBridge();

    return await new Promise<string>(async (resolve, reject) => {
      let isSettled = false;

      const cleanupCallbacks: Array<() => void> = [];
      const cleanup = () => {
        while (cleanupCallbacks.length > 0) {
          cleanupCallbacks.pop()?.();
        }
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

      cleanupCallbacks.push(
        bridge.onManagedStreamChunk(requestId, (content) => {
          onChunk(content);
        })
      );

      cleanupCallbacks.push(
        bridge.onManagedStreamDone(requestId, ({ content }) => {
          if (isSettled) return;
          isSettled = true;
          cleanup();
          resolve(content);
        })
      );

      cleanupCallbacks.push(
        bridge.onManagedStreamError(requestId, ({ message, statusCode, errorCode }) => {
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

      if (signal?.aborted) {
        settleAborted();
        return;
      }

      if (signal) {
        const abortHandler = () => {
          settleAborted();
        };
        signal.addEventListener('abort', abortHandler, { once: true });
        cleanupCallbacks.push(() => {
          signal.removeEventListener('abort', abortHandler);
        });
      }

      try {
        await bridge.startManagedChatCompletionStream(requestId, body);
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
