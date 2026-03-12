import type { AccountProvider } from '@/stores/accountSession/state';

export type OauthAccountProvider = Exclude<AccountProvider, 'email'>;

export function getAccountProviderLabel(provider: AccountProvider | null | undefined): string {
  switch (provider) {
    case 'github':
      return 'GitHub';
    case 'google':
      return 'Google';
    case 'email':
      return 'Email';
    default:
      return 'Account';
  }
}

export function normalizeAccountProvider(
  provider: string | null | undefined
): AccountProvider | null {
  if (!provider) return null;
  if (provider === 'github' || provider === 'google' || provider === 'email') {
    return provider;
  }
  return null;
}

export function isOauthAccountProvider(value: string): value is OauthAccountProvider {
  return value === 'github' || value === 'google';
}
