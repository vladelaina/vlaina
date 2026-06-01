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
import { AccountAvatarImage } from './AccountAvatarImage';

const fallbackAvatarUrl = `${import.meta.env.BASE_URL}logo.png?v=20260327`;
const membershipPlanUrl = 'https://vlaina.com/r/account_plan';

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
  const isMembershipPending = isConnected && !membershipTier && !membershipName;
  const shouldShowMembershipBadge = isConnected && !isMembershipPending && membershipTier !== 'free';
  const membershipBadgeLabel = membershipName || '';

  const membershipPillClassName = membershipTier === 'plus'
    ? 'bg-[var(--vlaina-color-membership-plus-bg)] text-[var(--vlaina-color-membership-plus-fg)]'
    : membershipTier === 'pro'
      ? 'bg-[var(--vlaina-color-membership-pro-bg)] text-[var(--vlaina-color-membership-pro-fg)]'
      : membershipTier === 'max'
        ? 'bg-[var(--vlaina-color-membership-max-bg)] text-[var(--vlaina-color-membership-max-fg)]'
        : membershipTier === 'ultra'
          ? 'bg-[var(--vlaina-color-membership-ultra-bg)] text-[var(--vlaina-color-membership-ultra-fg)]'
          : 'bg-[var(--vlaina-color-setting-field)] text-[var(--notes-sidebar-text)]';

  return (
    <div className="group relative flex select-none items-start gap-3 px-3 pb-2.5 pt-3">
      <div className="relative shrink-0 group/avatar">
        <div
          className={cn(
            'relative flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-[var(--vlaina-border)] bg-[var(--vlaina-color-input-surface)] shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-105'
          )}
        >
          <AccountAvatarImage
            src={userAvatar}
            fallbackSrc={fallbackAvatarUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        </div>
        {shouldShowMembershipBadge ? (
          <span
            role="button"
            tabIndex={0}
            onClick={() => void openExternalHref(membershipPlanUrl)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                void openExternalHref(membershipPlanUrl);
              }
            }}
            className={cn(
              'absolute -bottom-1 -right-1.5 z-10 inline-flex cursor-pointer select-none items-center rounded-[8px] px-1.5 py-[3px] text-[8px] font-semibold normal-case tracking-normal leading-none shadow-[var(--vlaina-shadow-badge)]',
              membershipPillClassName
            )}
          >
            {membershipBadgeLabel}
          </span>
        ) : null}
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
