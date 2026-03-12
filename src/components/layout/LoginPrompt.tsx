import React from 'react';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn } from '@/lib/utils';
import { AccountSignInOptions } from '@/components/account/AccountSignInOptions';

export const LoginPrompt: React.FC = () => {
  const { isConnecting, cancelConnect, error, signIn, requestEmailCode, verifyEmailCode } = useAccountSessionStore();
  const userAvatar = useUserAvatar();
  const displayAvatar = userAvatar || '/logo.png';

  return (
    <div className="p-2 pb-0">
      <div
        className={cn(
          'relative flex w-full items-center gap-3 overflow-hidden rounded-lg p-2 text-left transition-colors',
          isConnecting ? 'bg-[var(--neko-hover)]' : 'bg-transparent'
        )}
      >
        <div className="relative h-10 w-10 shrink-0">
          <img
            src={displayAvatar}
            alt="NekoTick"
            className="h-full w-full rounded-lg border border-[var(--neko-border)] object-cover shadow-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight text-[var(--neko-text-primary)]">
            {isConnecting ? 'Finishing in Browser...' : 'Sign in to NekoTick'}
          </span>
          <span className="mt-0.5 block truncate text-[12px] leading-tight text-[var(--neko-text-tertiary)]">
            {isConnecting ? 'Waiting for authorization' : 'Choose Google, GitHub, or an email verification code.'}
          </span>
        </div>

        {isConnecting ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              cancelConnect();
            }}
            className="rounded-md bg-[var(--neko-bg-secondary)] px-2.5 py-1 text-[11px] font-medium text-[var(--neko-text-secondary)] transition-colors active:scale-95 hover:bg-[var(--neko-border)]"
          >
            Cancel
          </button>
        ) : null}
      </div>
      <div className="px-2 pt-2">
          <AccountSignInOptions
            variant="compact"
            isConnecting={isConnecting}
            error={error}
            onOauthSignIn={signIn}
            onEmailCodeRequest={requestEmailCode}
            onEmailCodeVerify={verifyEmailCode}
          />
      </div>
      <div className="mx-2 mt-2 h-[1px] bg-[var(--neko-border)] opacity-40" />
    </div>
  );
};
