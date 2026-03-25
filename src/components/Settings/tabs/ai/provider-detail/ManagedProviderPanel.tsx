import { MANAGED_API_BASE } from '@/lib/ai/managedService';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';
import type { OauthAccountProvider } from '@/lib/account/provider';

interface ManagedProviderPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  authError: string | null;
  onConnect: (provider: OauthAccountProvider) => void | Promise<void>;
  onRequestEmailCode: (email: string) => Promise<boolean>;
  onVerifyEmailCode: (email: string, code: string) => Promise<boolean>;
  onDisconnect: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export function ManagedProviderPanel({
  isConnected,
  isConnecting,
  authError,
  onConnect,
  onRequestEmailCode,
  onVerifyEmailCode,
  onDisconnect,
  onRefresh,
}: ManagedProviderPanelProps) {
  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#202020] p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Managed by Vlaina Worker</h3>
              <p className="text-xs text-gray-500">
                Official hosted service. Your Vlaina account proves identity, while Vlaina controls model access and budget on the server.
              </p>
              <p className="text-xs text-gray-500">Base URL: {MANAGED_API_BASE}</p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    className="h-9 px-4 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDisconnect()}
                    className="h-9 px-4 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <div className="text-xs text-gray-500">Choose a provider below</div>
              )}
            </div>
          </div>

          {!isConnected ? (
            <AccountSignInOptions
              isConnecting={isConnecting}
              error={authError}
              onOauthSignIn={onConnect}
              onEmailCodeRequest={onRequestEmailCode}
              onEmailCodeVerify={onVerifyEmailCode}
            />
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Status</div>
              <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {isConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-white/[0.02] p-4 md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Account</div>
              <div className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                {isConnected ? 'Signed in to Vlaina' : 'Sign in required'}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Budget progress is shown in the account card under your avatar.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
