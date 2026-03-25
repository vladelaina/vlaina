export type AccountProvider = 'github' | 'google' | 'email';
export type MembershipTier = 'free' | 'plus' | 'pro' | 'max';

export interface AccountSessionState {
  isConnected: boolean;
  provider: AccountProvider | null;
  username: string | null;
  primaryEmail: string | null;
  avatarUrl: string | null;
  membershipTier: MembershipTier | null;
  membershipName: string | null;
  localAvatarUrl: string | null;
  isConnecting: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AccountSessionActions {
  checkStatus: () => Promise<void>;
  signIn: (provider: Exclude<AccountProvider, 'email'>) => Promise<boolean>;
  requestEmailCode: (email: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
  cancelConnect: () => void;
  handleAuthCallback: () => Promise<boolean>;
  hydrateAvatar: () => Promise<void>;
}

export type AccountSessionStore = AccountSessionState & AccountSessionActions;

export const ACCOUNT_USER_PERSIST_KEY = 'vlaina_account_identity';

export const initialAccountSessionState: AccountSessionState = {
  isConnected: false,
  provider: null,
  username: null,
  primaryEmail: null,
  avatarUrl: null,
  membershipTier: null,
  membershipName: null,
  localAvatarUrl: null,
  isConnecting: false,
  isLoading: true,
  error: null,
};
