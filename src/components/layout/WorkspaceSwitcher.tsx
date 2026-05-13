import React, { useCallback } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useAccountSessionStore } from '@/stores/accountSession';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useI18n } from '@/lib/i18n';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { ACCOUNT_LOGIN_REQUESTED_EVENT } from '@/lib/account/sessionEvent';
import { LoginPrompt } from './LoginPrompt';
import { AccountLoginDialog } from './AccountLoginDialog';
import { UserIdentityCard } from './UserIdentityCard';
import { AppMenu } from './AppMenu';

interface WorkspaceSwitcherProps {
  onOpenSettings?: () => void;
  className?: string;
}

const WorkspaceSwitcherBase = ({ onOpenSettings, className }: WorkspaceSwitcherProps) => {
  const { isConnected, username, primaryEmail, signOut } = useAccountSessionStore();
  const authPromptSessionId = useAIUIStore((state) => state.authPromptSessionId);
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const temporaryChatEnabled = useAIUIStore((state) => state.temporaryChatEnabled);
  const { t } = useI18n();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = React.useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = React.useState(false);

  const handleLogout = useCallback(async () => {
    setIsLogoutConfirmOpen(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    await signOut();
    setIsOpen(false);
    setIsLogoutConfirmOpen(false);
  }, [signOut]);

  const handleSwitchAccount = useCallback(() => {
    setIsOpen(false);
    setIsLoginDialogOpen(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      window.dispatchEvent(new Event('open-settings'));
    }
    setIsOpen(false);
  }, [onOpenSettings]);

  const userAvatar = useUserAvatar();
  const displayName = isConnected ? username || primaryEmail || 'vlaina' : 'vlaina';
  const displayAvatar =
    isConnected && userAvatar ? userAvatar : '/logo.png?v=20260327';

  const handleOpenLoginDialog = useCallback(() => {
    setIsOpen(false);
    setIsLoginDialogOpen(true);
  }, []);

  React.useEffect(() => {
    window.addEventListener(ACCOUNT_LOGIN_REQUESTED_EVENT, handleOpenLoginDialog);
    return () => {
      window.removeEventListener(ACCOUNT_LOGIN_REQUESTED_EVENT, handleOpenLoginDialog);
    };
  }, [handleOpenLoginDialog]);

  React.useEffect(() => {
    if (isConnected) {
      setIsLoginDialogOpen(false);
    }
  }, [isConnected, username, primaryEmail]);

  React.useEffect(() => {
    if (!isConnected || !authPromptSessionId) {
      return;
    }

    if (temporaryChatEnabled && currentSessionId === authPromptSessionId) {
      aiActions.promoteTemporarySession();
    }
    useAIUIStore.getState().setAuthPromptSessionId(null);
  }, [authPromptSessionId, currentSessionId, isConnected, temporaryChatEnabled]);

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              'vlaina-no-drag group relative flex size-8 cursor-pointer items-center justify-center overflow-visible rounded-[10px] bg-transparent text-[var(--vlaina-text-primary)] outline-none select-none',
              className
            )}
          >
            <span className="relative flex size-[26px] shrink-0 overflow-hidden rounded-[8px]">
              <img src={displayAvatar} alt={displayName} className="h-full w-full object-cover shadow-sm" />
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              'z-50 w-[260px] rounded-[26px] p-1.5 text-[var(--chat-sidebar-text)] select-none animate-in fade-in-0 zoom-in-95 duration-200 data-[side=bottom]:slide-in-from-top-2',
              chatComposerPillSurfaceClass
            )}
            sideOffset={8}
            align="start"
          >
            <div className="flex flex-col">
              {!isConnected ? (
                <LoginPrompt onOpenDialog={handleOpenLoginDialog} />
              ) : (
                <UserIdentityCard onLogout={handleLogout} onSwitchAccount={handleSwitchAccount} />
              )}

              {isConnected && <div className="mx-3 my-1 h-[1px] bg-[var(--vlaina-border)] opacity-50" />}

              <AppMenu onOpenSettings={handleOpenSettings} onCloseMenu={() => setIsOpen(false)} />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <AccountLoginDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} />
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => {
          void handleConfirmLogout();
        }}
        title={t('account.logOutTitle')}
        description={t('account.logOutDescription')}
        confirmText={t('account.logOut')}
        cancelText={t('account.logOutCancel')}
        variant="danger"
      />
    </>
  );
};

export const WorkspaceSwitcher = React.memo(WorkspaceSwitcherBase);
WorkspaceSwitcher.displayName = 'WorkspaceSwitcher';
