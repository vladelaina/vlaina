import { Icon } from '@/components/ui/icons';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { useI18n } from '@/lib/i18n';

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
            void onOauthSignIn(option.provider);
          }}
          className={cn(
            'group relative flex h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-full px-5 text-[14px] font-semibold tracking-tight text-[var(--vlaina-color-text-strong)] transition-all duration-200 active:scale-[0.985] sm:h-[60px] sm:px-6 sm:text-[15px] md:h-16',
            chatComposerPillSurfaceClass,
            isCompact && 'h-14 text-[14px]'
          )}
        >
          <Icon
            name="common.google"
            size={20}
            className="shrink-0"
          />

          <span className="opacity-90 group-hover:opacity-100 transition-opacity">
            {t('account.continueWithProvider', { provider: option.label })}
          </span>

          <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
            <div
              className={cn(
                'absolute inset-x-6 bottom-0 h-[3px] rounded-full bg-[var(--vlaina-color-brand-google-gradient)] opacity-0 transition-opacity duration-300',
                isBusy && 'animate-pulse opacity-100'
              )}
            />
          </div>
        </button>
      ))}
    </div>
  );
}
