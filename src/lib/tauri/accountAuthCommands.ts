import type { AccountProvider, MembershipTier } from '@/stores/accountSession/state';
import { safeInvoke } from './invoke';
import { listen } from '@tauri-apps/api/event';

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
    signal?: AbortSignal
  ) {
    const requestId = `managed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const chunkEvent = `managed-chat-stream:${requestId}:chunk`;
    const doneEvent = `managed-chat-stream:${requestId}:done`;
    const errorEvent = `managed-chat-stream:${requestId}:error`;

    let fullContent = '';

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
        cleanup();
        reject(new DOMException('The operation was aborted', 'AbortError'));
      };

      if (signal) {
        if (signal.aborted) {
          abortHandler();
          return;
        }
        signal.addEventListener('abort', abortHandler, { once: true });
        cleanupCallbacks.push(() => signal.removeEventListener('abort', abortHandler));
      }

      try {
        const unlistenChunk = await listen<string>(chunkEvent, (event) => {
          if (typeof event.payload !== 'string') {
            return;
          }
          fullContent = event.payload;
          onChunk(fullContent);
        });
        cleanupCallbacks.push(unlistenChunk);

        const unlistenDone = await listen<string | null>(doneEvent, (event) => {
          if (typeof event.payload === 'string') {
            fullContent = event.payload;
          }
          cleanup();
          resolve(fullContent);
        });
        cleanupCallbacks.push(unlistenDone);

        const unlistenError = await listen<string>(errorEvent, (event) => {
          cleanup();
          reject(new Error(typeof event.payload === 'string' ? event.payload : 'Managed stream failed'));
        });
        cleanupCallbacks.push(unlistenError);

        await safeInvoke('managed_chat_completion_stream', {
          requestId,
          body,
        }, {
          webFallback: undefined,
          throwOnWeb: true,
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  },

  async accountDisconnect() {
    return safeInvoke('account_disconnect');
  },
};
