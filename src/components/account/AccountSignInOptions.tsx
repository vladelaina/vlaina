import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { OauthAccountProvider } from '@/lib/account/provider';
import { hasBackendCommands } from '@/lib/tauri/invoke';
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
  const isDesktop = hasBackendCommands();
  const helpText = useMemo(() => {
    if (isConnecting) {
      return 'Complete authorization in the browser window that just opened.';
    }
    if (isDesktop) {
      return 'Desktop sign-in now uses a secure browser redirect back to the app. Email verification code is still available as a no-password fallback.';
    }
    return 'Google is the default account sign-in. Email verification code works well for non-technical users. GitHub stays available for advanced sync later.';
  }, [isConnecting, isDesktop]);

  return (
    <div className={cn('space-y-3', className)}>
      <AccountOauthButtons isCompact={isCompact} disabled={disabled} onOauthSignIn={onOauthSignIn} />

      <AccountEmailCodeCard
        isCompact={isCompact}
        disabled={disabled}
        onEmailCodeRequest={onEmailCodeRequest}
        onEmailCodeVerify={onEmailCodeVerify}
      />

      <div className={cn(isCompact ? 'text-[11px] text-[var(--neko-text-tertiary)]' : 'text-xs text-gray-500')}>
        {helpText}
      </div>

      {error ? (
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-xs',
            isCompact ? 'bg-red-500/10 text-red-500' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
          )}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
