import React, { useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import * as Popover from '@radix-ui/react-popover';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoginPrompt } from './LoginPrompt';
import { AccountLoginDialog } from './AccountLoginDialog';
import { UserIdentityCard } from './UserIdentityCard';
import { AppMenu } from './AppMenu';

interface WorkspaceSwitcherProps {
  onOpenSettings?: () => void;
}

const WorkspaceSwitcherBase = ({ onOpenSettings }: WorkspaceSwitcherProps) => {
  const { isConnected, username, primaryEmail, signOut } = useAccountSessionStore();

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
    onOpenSettings?.();
    setIsOpen(false);
  }, [onOpenSettings]);

  const displayName = username || primaryEmail || 'vlaina';
  const userAvatar = useUserAvatar();
  const displayAvatar = userAvatar || '/logo.png';

  const handleOpenLoginDialog = useCallback(() => {
    setIsOpen(false);
    setIsLoginDialogOpen(true);
  }, []);

  React.useEffect(() => {
    if (isConnected) {
      setIsLoginDialogOpen(false);
    }
  }, [isConnected, username, primaryEmail]);

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button
            className={cn(
              'group relative flex h-8 cursor-pointer items-center overflow-visible rounded-md px-1.5 py-1 text-[var(--vlaina-text-primary)] outline-none transition-colors select-none hover:bg-[var(--vlaina-hover)]',
              isOpen && 'bg-[var(--vlaina-hover)]'
            )}
          >
            <span className="relative flex h-5 w-5 shrink-0">
              <img src={displayAvatar} alt={displayName} className="h-5 w-5 rounded-sm object-cover shadow-sm" />
              <span className="pointer-events-none absolute -right-[4px] -bottom-[1px] flex h-3 w-3 items-center justify-center transition-transform duration-200 group-hover:scale-105">
                <Icon
                  name="nav.chevronDown"
                  className="h-2 w-2 text-[var(--vlaina-text-tertiary)] opacity-80 transition-opacity duration-200 group-hover:opacity-100"
                />
              </span>
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              'z-50 w-[260px] rounded-xl border border-[var(--vlaina-border)] bg-[var(--vlaina-bg-primary)] p-1.5 shadow-xl select-none animate-in fade-in-0 zoom-in-95 duration-200 data-[side=bottom]:slide-in-from-top-2 dark:bg-zinc-900'
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
        title="Log out?"
        description="You will be signed out of your current vlaina account on this device."
        confirmText="Log out"
        cancelText="Stay signed in"
        variant="danger"
      />
    </>
  );
};

export const WorkspaceSwitcher = React.memo(WorkspaceSwitcherBase);
WorkspaceSwitcher.displayName = 'WorkspaceSwitcher';
