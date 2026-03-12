import type { AccountProvider } from '@/stores/accountSession/state';
import { safeInvoke } from './invoke';

export const accountCommands = {
  async getAccountSessionStatus() {
    return safeInvoke<{
      connected: boolean;
      provider: AccountProvider | null;
      username: string | null;
      primaryEmail: string | null;
      avatarUrl: string | null;
    }>('get_account_session_status', undefined, {
      webFallback: {
        connected: false,
        provider: null,
        username: null,
        primaryEmail: null,
        avatarUrl: null,
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

  async managedChatCompletion(body: Record<string, unknown>) {
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

  async accountDisconnect() {
    return safeInvoke('account_disconnect');
  },
};
