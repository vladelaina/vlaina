import { useEffect, useRef } from 'react';
import { desktopWindow } from '@/lib/desktop/window';
import { recordDiagnostic } from '@/lib/diagnostics/appDiagnostics';

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
  clearRemoteImageMemoryCache,
  cancelNoteContentScan,
  onInitializingChange,
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
  clearRemoteImageMemoryCache: () => void;
  cancelNoteContentScan: () => void;
  onInitializingChange?: (initializing: boolean) => void;
}) {
  const initializedVaultPathRef = useRef<string | null>(null);
  const pendingStarredNavigationRef = useRef(pendingStarredNavigation);
  const lastSeenPendingStarredNavigationRef = useRef(pendingStarredNavigation);
  const pendingStarredNavigationTokenRef = useRef(0);
  const pendingOpenMarkdownTargetVaultPathRef = useRef(pendingOpenMarkdownTargetVaultPath);
  const lastSeenPendingOpenMarkdownTargetVaultPathRef = useRef(pendingOpenMarkdownTargetVaultPath);
  const pendingOpenMarkdownTargetTokenRef = useRef(0);

  if (pendingStarredNavigation !== lastSeenPendingStarredNavigationRef.current) {
    pendingStarredNavigationRef.current = pendingStarredNavigation;
    if (pendingStarredNavigation) {
      pendingStarredNavigationTokenRef.current += 1;
    }
  }
  lastSeenPendingStarredNavigationRef.current = pendingStarredNavigation;

  if (pendingOpenMarkdownTargetVaultPath !== lastSeenPendingOpenMarkdownTargetVaultPathRef.current) {
    pendingOpenMarkdownTargetVaultPathRef.current = pendingOpenMarkdownTargetVaultPath;
    if (pendingOpenMarkdownTargetVaultPath) {
      pendingOpenMarkdownTargetTokenRef.current += 1;
    }
  }
  lastSeenPendingOpenMarkdownTargetVaultPathRef.current = pendingOpenMarkdownTargetVaultPath;

  const pendingStarredNavigationToken = pendingStarredNavigationTokenRef.current;
  const pendingOpenMarkdownTargetToken = pendingOpenMarkdownTargetTokenRef.current;

  useEffect(() => {
    if (!currentVaultPath) {
      initializedVaultPathRef.current = null;
      onInitializingChange?.(false);
      return;
    }
    const pendingStarredNavigationForInit = pendingStarredNavigationRef.current;
    const pendingOpenMarkdownTargetVaultPathForInit = pendingOpenMarkdownTargetVaultPathRef.current;
    const hasPendingStarredNavigation =
      pendingStarredNavigationForInit?.vaultPath === currentVaultPath;
    const hasPendingOpenMarkdownTarget =
      pendingOpenMarkdownTargetVaultPathForInit === currentVaultPath;
    if (
      initializedVaultPathRef.current === currentVaultPath &&
      !hasPendingStarredNavigation &&
      !hasPendingOpenMarkdownTarget
    ) {
      return;
    }

    let cancelled = false;
    initializedVaultPathRef.current = currentVaultPath;
    onInitializingChange?.(true);

    const unlockWindow = async () => {
      try {
        await desktopWindow.setResizable(true);
      } catch (error) {
      }
    };

    const initializeVault = async () => {
      recordDiagnostic('notes.vaultInitialization', 'start', {
        currentVaultPath,
        launchNotePath,
        hasPendingStarredNavigation,
        hasPendingOpenMarkdownTarget,
      });
      await loadStarred(currentVaultPath);
      const shouldSkipWorkspaceRestore =
        hasPendingStarredNavigation &&
        pendingStarredNavigationForInit?.skipWorkspaceRestore === true;
      const skipWorkspaceRestore =
        Boolean(launchNotePath) || shouldSkipWorkspaceRestore || hasPendingOpenMarkdownTarget;
      recordDiagnostic('notes.vaultInitialization', 'load_file_tree_start', {
        currentVaultPath,
        skipWorkspaceRestore,
      });
      await Promise.all([
        loadAssets(currentVaultPath),
        loadFileTree(skipWorkspaceRestore),
        cleanupAssetTempFiles(),
      ]);
      recordDiagnostic('notes.vaultInitialization', 'load_file_tree_complete', {
        currentVaultPath,
        skipWorkspaceRestore,
      });

      if (!cancelled) {
        await unlockWindow();
      }

      if (!cancelled) {
        onInitializingChange?.(false);
      }
    };

    void initializeVault().catch((error) => {
      recordDiagnostic('notes.vaultInitialization', 'failed', {
        currentVaultPath,
        error,
      });
      if (!cancelled) {
        onInitializingChange?.(false);
      }
    });

    return () => {
      cancelled = true;
      cancelNoteContentScan();
      clearAssetUrlCache();
      clearRemoteImageMemoryCache();
    };
  }, [
    currentVaultPath,
    launchNotePath,
    pendingStarredNavigationToken,
    pendingOpenMarkdownTargetToken,
    loadStarred,
    loadAssets,
    loadFileTree,
    cleanupAssetTempFiles,
    clearAssetUrlCache,
    clearRemoteImageMemoryCache,
    cancelNoteContentScan,
    onInitializingChange,
  ]);
}
