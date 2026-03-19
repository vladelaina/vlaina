import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { AccountOauthButtons } from './AccountOauthButtons';
import { AccountEmailCodeCard } from './AccountEmailCodeCard';

interface AccountSignInOptionsProps {
  isConnecting: boolean;
  error: string | null;
  onOauthSignIn: (provider: OauthAccountProvider) => void | Promise<unknown>;
  onEmailCodeRequest: (email: string) => Promise<boolean>;
  onEmailCodeVerify: (email: string, code: string) => Promise<boolean>;
  variant?: 'compact' | 'panel';
  className?: string;
}

export function AccountSignInOptions({
  isConnecting,
  error,
  onOauthSignIn,
  onEmailCodeRequest,
  onEmailCodeVerify,
  variant = 'panel',
  className,
}: AccountSignInOptionsProps) {
  const isCompact = variant === 'compact';
  const disabled = isConnecting;

  return (
    <div className={cn('flex flex-col gap-6 px-4', className)}>
      {/* Social Actions */}
      <AccountOauthButtons isCompact={isCompact} disabled={disabled} onOauthSignIn={onOauthSignIn} />

      {/* Modern Separator - Subtle & Wide Space */}
      <div className="flex items-center gap-4 px-4">
        <div className="h-px flex-1 bg-zinc-100 dark:bg-white/5" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 dark:text-zinc-600">or</span>
        <div className="h-px flex-1 bg-zinc-100 dark:bg-white/5" />
      </div>

      {/* Email Action */}
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
              'bg-red-50 text-red-600 border border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
            )}
          >
            {error}
          </div>
        ) : null}

        <p className="px-8 text-[11px] text-center leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium opacity-80">
          By continuing, you agree to NekoTick&apos;s <span className="underline cursor-pointer opacity-80 hover:opacity-100 transition-opacity">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
