import React, { useCallback } from 'react';
import { Icon } from '@/components/ui/icons';
import * as Popover from '@radix-ui/react-popover';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useUserAvatar } from '@/hooks/useUserAvatar';
import { cn } from '@/lib/utils';
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

  const handleLogout = useCallback(async () => {
    await signOut();
    setIsOpen(false);
  }, [signOut]);

  const handleSwitchAccount = useCallback(async () => {
    await signOut();
    setIsOpen(true);
  }, [signOut]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
    setIsOpen(false);
  }, [onOpenSettings]);

  const displayName = username || primaryEmail || 'NekoTick';
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
  }, [isConnected]);

  return (
    <>
      <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <button
            className={cn(
              'group flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[var(--neko-text-primary)] outline-none transition-colors select-none hover:bg-[var(--neko-hover)]',
              isOpen && 'bg-[var(--neko-hover)]'
            )}
          >
            <img src={displayAvatar} alt={displayName} className="h-5 w-5 rounded-sm object-cover shadow-sm" />
            <span className="max-w-[120px] truncate pt-[1px] text-[13px] font-medium leading-none">
              {displayName}
            </span>
            <Icon
              name="nav.chevronDown"
              className="-ml-0.5 h-3.5 w-3.5 text-[var(--neko-text-tertiary)] opacity-0 transition-all duration-200 group-hover:opacity-70"
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              'z-50 w-[260px] rounded-xl border border-[var(--neko-border)] bg-[var(--neko-bg-primary)] p-1.5 shadow-xl select-none animate-in fade-in-0 zoom-in-95 duration-200 data-[side=bottom]:slide-in-from-top-2 dark:bg-zinc-900'
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

              {isConnected && <div className="mx-3 my-1 h-[1px] bg-[var(--neko-border)] opacity-50" />}

              <AppMenu onOpenSettings={handleOpenSettings} onCloseMenu={() => setIsOpen(false)} />
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <AccountLoginDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} />
    </>
  );
};

export const WorkspaceSwitcher = React.memo(WorkspaceSwitcherBase);
WorkspaceSwitcher.displayName = 'WorkspaceSwitcher';
