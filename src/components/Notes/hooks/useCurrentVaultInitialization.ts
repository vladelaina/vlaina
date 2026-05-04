import { useEffect } from 'react';
import { desktopWindow } from '@/lib/desktop/window';

export function useCurrentVaultInitialization({
  currentVaultPath,
  launchNotePath,
  pendingStarredNavigation,
  pendingOpenMarkdownTargetVaultPath,
  loadStarred,
  loadAssets,
  loadFileTree,
  cleanupAssetTempFiles,
  clearAssetUrlCache,
}: {
  currentVaultPath: string | null;
  launchNotePath: string | null | undefined;
  pendingStarredNavigation: { vaultPath: string; skipWorkspaceRestore?: boolean } | null;
  pendingOpenMarkdownTargetVaultPath: string | null;
  loadStarred: (vaultPath: string) => Promise<void>;
  loadAssets: (vaultPath: string) => Promise<void>;
  loadFileTree: (skipWorkspaceRestore?: boolean) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  clearAssetUrlCache: () => void;
}) {
  useEffect(() => {
    if (!currentVaultPath) return;
    let cancelled = false;

    const unlockWindow = async () => {
      try {
        await desktopWindow.setResizable(true);
      } catch (error) {
        console.error('Failed to unlock window:', error);
      }
    };

    const initializeVault = async () => {
      await loadStarred(currentVaultPath);
      const shouldSkipWorkspaceRestore =
        pendingStarredNavigation?.vaultPath === currentVaultPath &&
        pendingStarredNavigation.skipWorkspaceRestore === true;
      const shouldSkipRestoreForOpenMarkdownTarget =
        pendingOpenMarkdownTargetVaultPath === currentVaultPath;
      const skipWorkspaceRestore =
        Boolean(launchNotePath) || shouldSkipWorkspaceRestore || shouldSkipRestoreForOpenMarkdownTarget;
      await Promise.all([
        loadAssets(currentVaultPath),
        loadFileTree(skipWorkspaceRestore),
        cleanupAssetTempFiles(),
      ]);

      if (!cancelled) {
        await unlockWindow();
      }
    };

    void initializeVault();

    return () => {
      cancelled = true;
      clearAssetUrlCache();
    };
  }, [
    currentVaultPath,
    launchNotePath,
    pendingStarredNavigation,
    pendingOpenMarkdownTargetVaultPath,
    loadStarred,
    loadAssets,
    loadFileTree,
    cleanupAssetTempFiles,
    clearAssetUrlCache,
  ]);
}
