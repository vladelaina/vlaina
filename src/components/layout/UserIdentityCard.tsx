import React, { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn, iconButtonStyles } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { ManagedQuotaMeter } from './ManagedQuotaMeter';
import { BillingPlansDialog } from './BillingPlansDialog';

interface UserIdentityCardProps {
  onLogout: () => void | Promise<void>;
  onSwitchAccount: () => void;
}

export const UserIdentityCard: React.FC<UserIdentityCardProps> = ({ onLogout, onSwitchAccount }) => {
  const { username, primaryEmail, isConnected, membershipTier, membershipName } = useAccountSessionStore();
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false);

  const displayName = username || primaryEmail || 'vlaina';
  const displayIdentity = primaryEmail || username || 'vlaina';
  const userAvatar = useUserAvatar();
  const displayAvatar = userAvatar || '/logo.png?v=20260327';
  const membershipPillClassName = isConnected
    ? membershipTier === 'plus'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : membershipTier === 'pro'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : membershipTier === 'max'
          ? 'border-orange-200 bg-orange-50 text-orange-700'
          : 'border-zinc-200 bg-white text-zinc-700'
    : 'border-neutral-300 bg-white text-neutral-500 dark:border-neutral-600 dark:bg-zinc-900 dark:text-neutral-400';

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
          role="button"
          tabIndex={0}
          onClick={() => void openExternalHref('https://vlaina.com')}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void openExternalHref('https://vlaina.com');
            }
          }}
          className={cn(
            'absolute -bottom-1.5 -right-2 z-10 inline-flex cursor-pointer select-none items-center rounded-[10px] border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] leading-none shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:hover:border-zinc-500 dark:hover:text-white',
            membershipPillClassName
          )}
        >
          {isConnected ? membershipName || 'Free' : 'LOCAL'}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <div className="flex items-center justify-between">
          <span
            className="min-w-0 flex-1 truncate pr-2 text-[11px] font-bold leading-none text-[var(--vlaina-text-primary)]"
            title={displayIdentity}
          >
            {displayIdentity}
          </span>

          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className={cn(
                '-mr-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[var(--vlaina-active)]',
                isMenuOpen && 'bg-[var(--vlaina-active)] text-[var(--vlaina-text-primary)]'
              )}
            >
              <Icon size="md" name="common.more" className="text-[var(--vlaina-text-secondary)]" />
            </button>
          </div>
        </div>

        {isConnected ? <ManagedQuotaMeter /> : null}

        {isMenuOpen && (
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setIsMenuOpen(false)} />
            <div className="absolute left-[calc(100%-10px)] top-8 z-[70] w-44 rounded-lg border border-[var(--vlaina-border)] bg-[var(--vlaina-bg-primary)] p-1 shadow-xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onSwitchAccount();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
                  iconButtonStyles
                )}
              >
                <Icon size="md" name="user.switch" />
                {t('account.switchAccount')}
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsBillingDialogOpen(true);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
                  iconButtonStyles
                )}
              >
                <Icon size="md" name="misc.crown" />
                {t('account.membership')}
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  void onLogout();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors',
                  iconButtonStyles
                )}
              >
                <Icon size="md" name="user.logout" />
                {t('account.logOut')}
              </button>
            </div>
          </>
        )}
      </div>

      <BillingPlansDialog open={isBillingDialogOpen} onOpenChange={setIsBillingDialogOpen} />
    </div>
  );
};
