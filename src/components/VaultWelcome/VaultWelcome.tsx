/**
 * VaultWelcome - Welcome screen for vault selection
 */

import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { useVaultStore } from '@/stores/useVaultStore';
import { useSyncStore } from '@/stores/useSyncStore';
import { cn } from '@/lib/utils';
import { BrandHeader } from './components/BrandHeader';
import { RecentVaultsList } from './components/RecentVaultsList';
import { ActionButtons } from './components/ActionButtons';
import { CloudSyncSection } from './components/CloudSyncSection';
import { CreateVaultModal } from './components/CreateVaultModal';
import './VaultWelcome.css';

export function VaultWelcome() {
  const { initialize, recentVaults, openVault, checkVaultOpenInOtherWindow, isLoading } = useVaultStore();
  const { isConnected: isSyncConnected } = useSyncStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initialize().then(() => setIsInitialized(true));
  }, [initialize]);

  // Window Layout Management: Lock for Welcome, Open for App
  useEffect(() => {
    const appWindow = getCurrentWindow();

    // 1. Enter Welcome Screen: Lock it down
    const lockWindow = async () => {
      try {
        // Enforce a strict "card" size and disable resizing using backend command
        await invoke('set_window_resizable', { resizable: false });

        // Use 450x640 for the welcome screen (fits everything perfectly)
        // If user is already logged in (sync connected), we could shrink it,
        // but keeping it consistent (640) prevents layout jumping if they logout.
        // Let's stick to the 450x640 "Golden Ratio" card size for now.
        const width = 450;
        const height = isSyncConnected ? 520 : 640;

        await appWindow.setSize(new LogicalSize(width, height));
        await appWindow.center(); // Center nicely on screen
      } catch (e) {
        console.error('Failed to lock window:', e);
      }
    };

    lockWindow();

    // 2. Leave Welcome Screen (Cleanup): Unlock for Work Interface
    return () => {
      const unlockWindow = async () => {
        try {
          // Re-enable resizing and maximizing for the main app using backend command
          await invoke('set_window_resizable', { resizable: true });

          // Restore to a productive workspace size (e.g., 1024x768 or previous state)
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
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Vault Folder',
    });

    if (selected && typeof selected === 'string') {
      await handleOpenRecent(selected);
    }
  };

  const handleOpenRecent = async (path: string) => {
    // Check if vault is already open in another window
    const existingWindowLabel = await checkVaultOpenInOtherWindow(path);

    if (existingWindowLabel) {
      // Vault is open in another window - focus that window and close this one
      await invoke('focus_window', { label: existingWindowLabel });
      // Close current window if it's a new/welcome window
      getCurrentWindow().close();
      return;
    }

    // Vault not open elsewhere, open it in this window
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
            <RecentVaultsList
              vaults={recentVaults}
              onOpen={handleOpenRecent}
            />
          )}

          <ActionButtons
            onCreateNew={() => setShowCreateModal(true)}
            onOpenLocal={handleOpenLocal}
          />

          <CloudSyncSection />
        </div>
      </div>

      <CreateVaultModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
