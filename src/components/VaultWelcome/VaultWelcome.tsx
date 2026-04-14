import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize } from '@tauri-apps/api/dpi';
import { useVaultStore } from '@/stores/useVaultStore';
import { windowCommands } from '@/lib/tauri/invoke';
import { isTauri } from '@/lib/storage/adapter';
import { cn } from '@/lib/utils';
import { RecentVaultsList } from './components/RecentVaultsList';
import './VaultWelcome.css';

export function VaultWelcome() {
  const { initialize, recentVaults, openVault, isLoading } =
    useVaultStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initialize().then(() => setIsInitialized(true));
  }, [initialize]);

  useEffect(() => {
    if (!isTauri()) return;

    const lockWindow = async () => {
      try {
        const appWindow = getCurrentWindow();
        await windowCommands.setResizable(false);
        await appWindow.setSize(new LogicalSize(980, 640));
        await appWindow.center();
      } catch (e) {
        console.error('Failed to lock window:', e);
      }
    };

    void lockWindow();

    return () => {
      const unlockWindow = async () => {
        try {
          const appWindow = getCurrentWindow();
          await windowCommands.setResizable(true);
          await appWindow.setSize(new LogicalSize(980, 640));
          await appWindow.center();
        } catch (e) {
          console.error('Failed to unlock window:', e);
        }
      };
      void unlockWindow();
    };
  }, []);

  const handleOpenRecent = async (path: string) => {
    await openVault(path);
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <div className={cn('vault-welcome', isLoading && 'vault-welcome--loading')}>
      <div className="vault-welcome__content">
        <div className="vault-welcome__main">
          {recentVaults.length > 0 && (
            <RecentVaultsList vaults={recentVaults} onOpen={handleOpenRecent} />
          )}
        </div>
      </div>
    </div>
  );
}
