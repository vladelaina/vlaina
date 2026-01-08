/**
 * VaultWelcome - Welcome screen for vault selection
 */

import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useVaultStore } from '@/stores/useVaultStore';
import { cn } from '@/lib/utils';
import { BrandHeader } from './components/BrandHeader';
import { RecentVaultsList } from './components/RecentVaultsList';
import { ActionButtons } from './components/ActionButtons';
import { CloudSyncSection } from './components/CloudSyncSection';
import { CreateVaultModal } from './components/CreateVaultModal';
import './VaultWelcome.css';

export function VaultWelcome() {
  const { initialize, recentVaults, openVault, checkVaultOpenInOtherWindow, isLoading } = useVaultStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initialize().then(() => setIsInitialized(true));
  }, [initialize]);

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

          <div className="vault-welcome__divider"><span>or</span></div>

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
