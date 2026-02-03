import { useState, useEffect } from 'react';
import { useVaultStore } from '@/stores/useVaultStore';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { openDialog, hasNativeDialogs } from '@/lib/storage/dialog';
import { windowCommands, hasBackendCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';
import { cn } from '@/lib/utils';
import { BrandHeader } from './components/BrandHeader';
import { RecentVaultsList } from './components/RecentVaultsList';
import { ActionButtons } from './components/ActionButtons';
import { CloudSyncSection } from './components/CloudSyncSection';
import { CreateVaultModal } from './components/CreateVaultModal';
import './VaultWelcome.css';

export function VaultWelcome() {
  const { initialize, recentVaults, openVault, checkVaultOpenInOtherWindow, isLoading } =
    useVaultStore();
  const { isConnected: isSyncConnected } = useGithubSyncStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initialize().then(() => setIsInitialized(true));
  }, [initialize]);

  useEffect(() => {
    if (!isTauri()) return;

    const lockWindow = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { LogicalSize } = await import('@tauri-apps/api/dpi');
        const appWindow = getCurrentWindow();

        await windowCommands.setResizable(false);

        const width = 450;
        const height = isSyncConnected ? 520 : 640;

        await appWindow.setSize(new LogicalSize(width, height));
        await appWindow.center();
      } catch (e) {
        console.error('Failed to lock window:', e);
      }
    };

    lockWindow();

    return () => {
      const unlockWindow = async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const { LogicalSize } = await import('@tauri-apps/api/dpi');
          const appWindow = getCurrentWindow();

          await windowCommands.setResizable(true);
          await appWindow.setSize(new LogicalSize(1024, 768));
          await appWindow.center();
        } catch (e) {
          console.error('Failed to unlock window:', e);
        }
      };
      unlockWindow();
    };
  }, [isSyncConnected]);

  const handleOpenLocal = async () => {
    if (!hasNativeDialogs()) {
      setShowCreateModal(true);
      return;
    }

    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Select Vault Folder',
    });

    if (selected && typeof selected === 'string') {
      await handleOpenRecent(selected);
    }
  };

  const handleOpenRecent = async (path: string) => {
    if (hasBackendCommands()) {
      const existingWindowLabel = await checkVaultOpenInOtherWindow(path);

      if (existingWindowLabel) {
        await windowCommands.focusWindow(existingWindowLabel);
        if (isTauri()) {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          getCurrentWindow().close();
        }
        return;
      }
    }

    await openVault(path);
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <div className={cn('vault-welcome', isLoading && 'vault-welcome--loading')}>
      <div className="vault-welcome__content">
        <BrandHeader />

        <div className="vault-welcome__main">
          {recentVaults.length > 0 && (
            <RecentVaultsList vaults={recentVaults} onOpen={handleOpenRecent} />
          )}

          <ActionButtons
            onCreateNew={() => setShowCreateModal(true)}
            onOpenLocal={handleOpenLocal}
          />

          <CloudSyncSection />
        </div>
      </div>

      <CreateVaultModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}