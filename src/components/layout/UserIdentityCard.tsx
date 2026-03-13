import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn, iconButtonStyles } from '@/lib/utils';

interface UserIdentityCardProps {
  onLogout: () => void;
  onSwitchAccount: () => void;
}

export const UserIdentityCard: React.FC<UserIdentityCardProps> = ({ onLogout, onSwitchAccount }) => {
  const { username, primaryEmail, isConnected } = useAccountSessionStore();
  const { budget, refreshBudget } = useManagedAIStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const displayName = username || primaryEmail || 'NekoTick';
  const userAvatar = useUserAvatar();
  const displayAvatar = userAvatar || '/logo.png';
  const remainingPercent = Math.max(0, Math.min(100, budget?.remainingPercent || 0));

  useEffect(() => {
    if (!isConnected) {
      return;
    }
    void refreshBudget();
  }, [isConnected, refreshBudget]);

  return (
    <div className="group relative flex select-none items-start gap-3 px-3 pb-2.5 pt-3">
      <div className="relative shrink-0 group/avatar">
        <div
          className={cn(
            'relative flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-neutral-200/50 bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-105 dark:border-zinc-700/50 dark:bg-zinc-800/90'
          )}
        >
          <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover" />
        </div>
        <span
          className={cn(
            'absolute -bottom-1 -right-1 z-10 rounded-full border-2 border-[var(--neko-bg-primary)] px-1.5 py-0.5 text-[8px] font-bold shadow-sm select-none',
            isConnected
              ? 'bg-[#E6F4FF] text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#0A84FF]'
              : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
          )}
        >
          {isConnected ? 'AI' : 'LOCAL'}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <div className="flex items-center justify-between">
          <span className="truncate pr-2 text-[14px] font-bold leading-none text-[var(--neko-text-primary)]">
            {displayName}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className={cn(
              '-mr-1 flex h-5 w-5 items-center justify-center rounded-md transition-colors hover:bg-[var(--neko-active)]',
              isMenuOpen && 'bg-[var(--neko-active)] text-[var(--neko-text-primary)]'
            )}
          >
            <Icon size="md" name="common.more" className="text-[var(--neko-text-secondary)]" />
          </button>
        </div>

        {isConnected && budget ? (
          <div className="mt-1 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#e9e6df]">
                <div
                  className="h-full rounded-full bg-[#10b981] transition-all"
                  style={{ width: `${remainingPercent}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-[var(--neko-text-tertiary)]">
              {`${remainingPercent.toFixed(0)}%`}
            </span>
          </div>
        ) : null}

        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute left-[calc(100%-10px)] top-8 z-[70] w-40 rounded-lg border border-[var(--neko-border)] bg-[var(--neko-bg-primary)] p-1 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onSwitchAccount();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
                  iconButtonStyles
                )}
              >
                <Icon size="md" name="user.switch" />
                Switch Account
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onLogout();
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
                  iconButtonStyles
                )}
              >
                <Icon size="md" name="user.logout" />
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
