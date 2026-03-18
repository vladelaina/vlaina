import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';

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
  return (
    <div className={cn('flex flex-col gap-3', isCompact && 'gap-2')}>
      {OAUTH_OPTIONS.map((option) => (
        <button
          key={option.provider}
          type="button"
          disabled={disabled}
          onClick={() => void onOauthSignIn(option.provider)}
          className={cn(
            'group relative flex h-14 w-full cursor-pointer items-center justify-center gap-3 px-5 sm:h-[60px] sm:px-6 md:h-16',
            // Ceramic Pro Action Style: White with Depth
            'bg-white dark:bg-zinc-800/50 text-zinc-950 dark:text-white',
            'border border-zinc-200/60 dark:border-white/10',
            'rounded-[22px] sm:rounded-[24px] md:rounded-[28px] font-black text-[14px] sm:text-[15px] tracking-tight transition-all duration-500',
            'shadow-[0_10px_20px_rgba(0,0,0,0.02),inset_0_0_15px_rgba(0,0,0,0.01)]',
            'hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:scale-[1.01] active:scale-[0.97]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isCompact && 'h-14 rounded-2xl text-[14px]'
          )}
        >
          <Icon
            name="common.google"
            size={20}
            className="shrink-0"
          />

          <span className="opacity-90 group-hover:opacity-100 transition-opacity">Continue with {option.label}</span>

          {/* Specular Highlight Overlay */}
          <div className="absolute inset-0 rounded-[28px] overflow-hidden pointer-events-none">
             <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity dark:from-white/5" />
          </div>
        </button>
      ))}
    </div>
  );
}
