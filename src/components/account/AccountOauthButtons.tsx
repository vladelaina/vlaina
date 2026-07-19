import { Icon } from '@/components/ui/icons';
import { raisedPillSurfaceClass } from '@/components/ui/surfaceStyles';
import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { useI18n } from '@/lib/i18n';
import { themeIconTokens } from '@/styles/themeTokens';

interface AccountOauthButtonsProps {
  isCompact?: boolean;
  disabled?: boolean;
  onOauthSignIn: (provider: OauthAccountProvider) => void | Promise<unknown>;
}

interface OauthOption {
  provider: OauthAccountProvider;
  label: string;
}

const OAUTH_OPTIONS: OauthOption[] = [
  {
    provider: 'google',
    label: 'Google',
  },
];

export function AccountOauthButtons({
  isCompact,
  disabled,
  onOauthSignIn,
}: AccountOauthButtonsProps) {
  const { t } = useI18n();
  const isBusy = disabled === true;

  return (
    <div className={cn('flex flex-col gap-3', isCompact && 'gap-2')}>
      {OAUTH_OPTIONS.map((option) => (
        <button
          key={option.provider}
          type="button"
          aria-disabled={disabled ? 'true' : undefined}
          onClick={() => {
            if (disabled) return;
            void Promise.resolve(onOauthSignIn(option.provider)).catch(() => undefined);
          }}
          className={cn(
            'group relative flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-full px-5 text-[var(--vlaina-font-sm)] font-semibold tracking-tight text-[var(--vlaina-color-text-strong)] transition-all duration-[var(--vlaina-duration-200)] active:scale-[var(--vlaina-scale-985)] sm:h-[var(--vlaina-size-60px)] sm:px-6 sm:text-[var(--vlaina-font-15)] md:h-16',
            raisedPillSurfaceClass,
            isCompact && 'h-14 text-[var(--vlaina-font-sm)]'
          )}
        >
          <Icon
            name="common.google"
            size={themeIconTokens.sizeMd}
            className="shrink-0"
          />

          <span className="opacity-[var(--vlaina-opacity-90)] group-hover:opacity-[var(--vlaina-opacity-100)] transition-opacity">
            {t('account.continueWithProvider', { provider: option.label })}
          </span>

          <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
            <div
              className={cn(
                'absolute inset-x-6 bottom-0 h-[var(--vlaina-size-3px)] rounded-full bg-[var(--vlaina-color-brand-google-gradient)] opacity-[var(--vlaina-opacity-0)] transition-opacity duration-[var(--vlaina-duration-300)]',
                isBusy && 'animate-pulse opacity-[var(--vlaina-opacity-100)]'
              )}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
