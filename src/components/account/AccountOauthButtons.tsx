import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';

interface AccountOauthButtonsProps {
  isCompact: boolean;
  disabled: boolean;
  onOauthSignIn: (provider: OauthAccountProvider) => void | Promise<unknown>;
}

interface OauthOption {
  provider: OauthAccountProvider;
  title: string;
  description: string;
}

const OAUTH_OPTIONS: OauthOption[] = [
  {
    provider: 'google',
    title: 'Continue with Google',
    description: 'Recommended default sign-in.',
  },
  {
    provider: 'github',
    title: 'Continue with GitHub',
    description: 'Advanced account and future sync connector.',
  },
];

export function AccountOauthButtons({
  isCompact,
  disabled,
  onOauthSignIn,
}: AccountOauthButtonsProps) {
  return (
    <div className={cn('grid gap-2', isCompact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
      {OAUTH_OPTIONS.map((option) => (
        <button
          key={option.provider}
          type="button"
          disabled={disabled}
          onClick={() => void onOauthSignIn(option.provider)}
          className={cn(
            'rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            isCompact
              ? 'border-[var(--neko-border)] bg-[var(--neko-bg-secondary)] hover:bg-[var(--neko-hover)]'
              : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-[#202020] dark:hover:bg-white/5'
          )}
        >
          <div className={cn('font-semibold', isCompact ? 'text-[13px]' : 'text-sm text-gray-900 dark:text-gray-100')}>
            {option.title}
          </div>
          <div
            className={cn(
              isCompact ? 'mt-0.5 text-[11px] text-[var(--neko-text-tertiary)]' : 'mt-1 text-xs text-gray-500'
            )}
          >
            {option.description}
          </div>
        </button>
      ))}
    </div>
  );
}
