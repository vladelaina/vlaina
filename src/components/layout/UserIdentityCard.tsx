import React, { useState } from 'react';
import { Icon } from '@/components/ui/icons';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { ManagedQuotaMeter } from './ManagedQuotaMeter';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { getSidebarIdleRowSurfaceClass } from '@/components/layout/sidebar/sidebarLabelStyles';

const fallbackAvatarUrl = `${import.meta.env.BASE_URL}logo.png?v=20260327`;

interface UserIdentityCardProps {
  onLogout: () => void | Promise<void>;
  onSwitchAccount: () => void;
}

export const UserIdentityCard: React.FC<UserIdentityCardProps> = ({ onLogout, onSwitchAccount }) => {
  const { username, primaryEmail, isConnected, membershipTier, membershipName } = useAccountSessionStore();
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const displayName = username || primaryEmail || 'vlaina';
  const displayIdentity = primaryEmail || username || 'vlaina';
  const userAvatar = useUserAvatar();
  const displayAvatar = userAvatar || fallbackAvatarUrl;
  const isMembershipPending = isConnected && !membershipTier && !membershipName;
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
            'absolute -bottom-1.5 -right-2 z-10 inline-flex cursor-pointer select-none items-center rounded-[10px] border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] leading-none shadow-[0_8px_18px_rgba(15,23,42,0.08)]',
            membershipPillClassName
          )}
        >
          {isMembershipPending ? (
            <span className="block h-2 w-7 animate-pulse rounded-full bg-current opacity-25" aria-hidden="true" />
          ) : (
            isConnected ? membershipName || (membershipTier === 'free' ? 'Free' : '') : 'LOCAL'
          )}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
        <div className="flex items-center justify-between">
          <span
            className="min-w-0 flex-1 truncate pr-2 text-[11px] font-bold leading-none text-[var(--vlaina-text-primary)]"
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
            <div
              className={cn(
                "absolute left-[calc(100%-10px)] top-8 z-[70] w-48 rounded-[22px] border-transparent p-1 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1",
                chatComposerPillSurfaceClass
              )}
            >
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onSwitchAccount();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-[16px] font-medium transition-colors',
                  getSidebarIdleRowSurfaceClass('chat'),
                  'text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]'
                )}
              >
                <Icon size="md" name="user.switch" className="text-[var(--chat-sidebar-text)]" />
                <span className="whitespace-nowrap">{t('account.switchAccount')}</span>
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  void onLogout();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-[16px] font-medium transition-colors',
                  getSidebarIdleRowSurfaceClass('chat'),
                  'text-[var(--chat-sidebar-text)] hover:bg-[var(--chat-sidebar-row-hover)]'
                )}
              >
                <Icon size="md" name="user.logout" className="text-[var(--chat-sidebar-text)]" />
                {t('account.logOut')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
