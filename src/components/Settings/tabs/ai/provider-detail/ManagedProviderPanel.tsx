import { MANAGED_API_BASE } from '@/lib/ai/managedService';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4">
      <section className="rounded-2xl border border-[var(--vlaina-border)] bg-[var(--vlaina-color-setting-field)] p-6">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--notes-sidebar-text)]">{t('settings.ai.managedTitle')}</h3>
              <p className="text-xs text-[var(--notes-sidebar-text-soft)]">
                {t('settings.ai.managedDescription')}
              </p>
              <p className="text-xs text-[var(--notes-sidebar-text-soft)]">{t('settings.ai.baseUrl', { url: MANAGED_API_BASE })}</p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    className="h-9 px-4 text-xs font-semibold rounded-lg border border-[var(--vlaina-border)] text-[var(--notes-sidebar-text)] hover:bg-[var(--vlaina-hover)]"
                  >
                    {t('settings.ai.refresh')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDisconnect()}
                    className="h-9 px-4 text-xs font-semibold rounded-lg border border-[var(--vlaina-color-status-danger-bg)] text-[var(--vlaina-color-status-danger-fg)] hover:bg-[var(--vlaina-color-status-danger-bg)]"
                  >
                    {t('settings.ai.disconnect')}
                  </button>
                </>
              ) : (
                <div className="text-xs text-[var(--notes-sidebar-text-soft)]">{t('settings.ai.chooseProvider')}</div>
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
            <div className="rounded-xl border border-[var(--vlaina-border)] bg-[var(--vlaina-color-row-soft)] p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--notes-sidebar-text-soft)]">{t('settings.ai.status')}</div>
              <div className="mt-2 text-sm font-medium text-[var(--notes-sidebar-text)]">
                {isConnected ? t('settings.ai.connected') : t('settings.ai.notConnected')}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--vlaina-border)] bg-[var(--vlaina-color-row-soft)] p-4 md:col-span-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--notes-sidebar-text-soft)]">{t('settings.ai.account')}</div>
              <div className="mt-2 text-sm font-medium text-[var(--notes-sidebar-text)]">
                {isConnected ? t('settings.ai.signedIn') : t('settings.ai.signInRequired')}
              </div>
              <p className="mt-1 text-xs text-[var(--notes-sidebar-text-soft)]">
                {t('settings.ai.budgetInAccountCard')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
