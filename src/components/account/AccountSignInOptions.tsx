import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { AccountOauthButtons } from './AccountOauthButtons';
import { AccountEmailCodeCard } from './AccountEmailCodeCard';
import { useI18n } from '@/lib/i18n';
import { openExternalHref } from '@/lib/navigation/externalLinks';

interface AccountSignInOptionsProps {
  isConnecting: boolean;
  error: string | null;
  onOauthSignIn: (provider: OauthAccountProvider) => void | Promise<unknown>;
  onEmailCodeRequest: (email: string) => Promise<boolean>;
  onEmailCodeVerify: (email: string, code: string) => Promise<boolean>;
  variant?: 'compact' | 'panel';
  className?: string;
}

const privacyPolicyUrl = 'https://github.com/vladelaina/vlaina/blob/main/PRIVACY.md';

export function AccountSignInOptions({
  isConnecting,
  error,
  onOauthSignIn,
  onEmailCodeRequest,
  onEmailCodeVerify,
  variant = 'panel',
  className,
}: AccountSignInOptionsProps) {
  const { t } = useI18n();
  const isCompact = variant === 'compact';
  const disabled = isConnecting;

  return (
    <div className={cn('flex flex-col gap-6 px-4', className)}>
      <AccountOauthButtons isCompact={isCompact} disabled={disabled} onOauthSignIn={onOauthSignIn} />

      <div className="flex items-center gap-4 px-4">
        <div className="h-px flex-1 bg-zinc-100 dark:bg-white/5" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-600">{t('account.or')}</span>
        <div className="h-px flex-1 bg-zinc-100 dark:bg-white/5" />
      </div>

      <div className="space-y-6">
        <AccountEmailCodeCard
          isCompact={isCompact}
          disabled={disabled}
          onEmailCodeRequest={onEmailCodeRequest}
          onEmailCodeVerify={onEmailCodeVerify}
        />

        {error ? (
          <div
            className={cn(
              'rounded-2xl px-6 py-4 text-[13px] font-medium animate-in slide-in-from-top-2 duration-300',
              'bg-[rgba(240,138,166,0.12)] text-[var(--vlaina-color-brand-pink)] dark:bg-[rgba(240,138,166,0.14)]'
            )}
          >
            {error}
          </div>
        ) : null}

        <p className="px-8 text-[11px] text-center leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium opacity-80">
          {t('account.privacyAgreement')}{' '}
          <button
            type="button"
            onClick={() => void openExternalHref(privacyPolicyUrl)}
            className="inline p-0 underline cursor-pointer opacity-80 transition-opacity hover:opacity-100"
          >
            {t('account.privacyPolicy')}
          </button>
          .
        </p>
      </div>
    </div>
  );
}
