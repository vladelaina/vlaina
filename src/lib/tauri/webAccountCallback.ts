import type { AccountProvider } from '@/stores/accountSession/state';
import { isOauthAccountProvider, normalizeAccountProvider } from '@/lib/account/provider';

export interface WebAccountAuthCallback {
  provider: AccountProvider | null;
  state: string | null;
  error: string | null;
  code?: string | null;
}

export function handleWebAccountAuthCallback(): WebAccountAuthCallback | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const provider =
    normalizeAccountProvider(params.get('auth_provider')) || normalizeAccountProvider(params.get('provider'));
  const providerState = params.get('state');
  const state = params.get('auth_state');
  const error = params.get('auth_error');
  const callbackError = params.get('error');

  const cleanup = () => window.history.replaceState({}, '', window.location.pathname);

  if (error || callbackError) {
    cleanup();
    return { provider, state: state ?? providerState, error: error ?? callbackError, code };
  }

  if (state) {
    cleanup();
    return { provider, state, error: null, code };
  }

  if (providerState && code) {
    cleanup();
    return { provider, state: providerState, error: null, code };
  }

  if (provider && isOauthAccountProvider(provider) && params.has('auth_state')) {
    cleanup();
    return { provider, state, error: null, code };
  }

  return null;
}
