import { useEffect, useState } from 'react';
import { useVaultStore } from '@/stores/useVaultStore';
import { desktopWindow } from '@/lib/desktop/window';
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
    const lockWindow = async () => {
        try {
          await desktopWindow.setResizable(false);
      } catch (e) {
      }
    };

    void lockWindow();

    return () => {
      const unlockWindow = async () => {
        try {
          await desktopWindow.setResizable(true);
        } catch (e) {
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
