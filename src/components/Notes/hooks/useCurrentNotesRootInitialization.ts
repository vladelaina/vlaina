import { useEffect, useRef } from 'react';
import { desktopWindow } from '@/lib/desktop/window';

export function useCurrentNotesRootInitialization({
  currentNotesRootPath,
  launchNotePath,
  pendingStarredNavigation,
  pendingOpenMarkdownTargetNotesRootPath,
  loadStarred,
  loadFileTree,
  cleanupAssetTempFiles,
  clearAssetUrlCache,
  clearRemoteImageMemoryCache,
  cancelNoteContentScan,
  onInitializingChange,
}: {
  currentNotesRootPath: string | null;
  launchNotePath: string | null | undefined;
  pendingStarredNavigation: { notesRootPath: string; skipWorkspaceRestore?: boolean } | null;
  pendingOpenMarkdownTargetNotesRootPath: string | null;
  loadStarred: (notesRootPath: string) => Promise<void>;
  loadFileTree: (skipWorkspaceRestore?: boolean) => Promise<void>;
  cleanupAssetTempFiles: () => Promise<void>;
  clearAssetUrlCache: () => void;
  clearRemoteImageMemoryCache: () => void;
  cancelNoteContentScan: () => void;
  onInitializingChange?: (initializing: boolean) => void;
}) {
  const initializedNotesRootPathRef = useRef<string | null>(null);
  const pendingStarredNavigationRef = useRef(pendingStarredNavigation);
  const lastSeenPendingStarredNavigationRef = useRef(pendingStarredNavigation);
  const pendingStarredNavigationTokenRef = useRef(0);
  const pendingOpenMarkdownTargetNotesRootPathRef = useRef(pendingOpenMarkdownTargetNotesRootPath);
  const lastSeenPendingOpenMarkdownTargetNotesRootPathRef = useRef(pendingOpenMarkdownTargetNotesRootPath);
  const pendingOpenMarkdownTargetTokenRef = useRef(0);

  if (pendingStarredNavigation !== lastSeenPendingStarredNavigationRef.current) {
    pendingStarredNavigationRef.current = pendingStarredNavigation;
    if (pendingStarredNavigation) {
      pendingStarredNavigationTokenRef.current += 1;
    }
  }
  lastSeenPendingStarredNavigationRef.current = pendingStarredNavigation;

  if (pendingOpenMarkdownTargetNotesRootPath !== lastSeenPendingOpenMarkdownTargetNotesRootPathRef.current) {
    pendingOpenMarkdownTargetNotesRootPathRef.current = pendingOpenMarkdownTargetNotesRootPath;
    if (pendingOpenMarkdownTargetNotesRootPath) {
      pendingOpenMarkdownTargetTokenRef.current += 1;
    }
  }
  lastSeenPendingOpenMarkdownTargetNotesRootPathRef.current = pendingOpenMarkdownTargetNotesRootPath;

  const pendingStarredNavigationToken = pendingStarredNavigationTokenRef.current;
  const pendingOpenMarkdownTargetToken = pendingOpenMarkdownTargetTokenRef.current;

  useEffect(() => {
    if (!currentNotesRootPath) {
      initializedNotesRootPathRef.current = null;
      onInitializingChange?.(false);
      return;
    }
    const pendingStarredNavigationForInit = pendingStarredNavigationRef.current;
    const pendingOpenMarkdownTargetNotesRootPathForInit = pendingOpenMarkdownTargetNotesRootPathRef.current;
    const hasPendingStarredNavigation =
      pendingStarredNavigationForInit?.notesRootPath === currentNotesRootPath;
    const hasPendingOpenMarkdownTarget =
      pendingOpenMarkdownTargetNotesRootPathForInit === currentNotesRootPath;
    if (
      initializedNotesRootPathRef.current === currentNotesRootPath &&
      !hasPendingStarredNavigation &&
      !hasPendingOpenMarkdownTarget
    ) {
      return;
    }

    let cancelled = false;
    initializedNotesRootPathRef.current = currentNotesRootPath;
    onInitializingChange?.(true);

    const unlockWindow = async () => {
      try {
        await desktopWindow.setResizable(true);
      } catch {
      }
    };

    const initializeNotesRoot = async () => {
      const shouldSkipWorkspaceRestore =
        hasPendingStarredNavigation &&
        pendingStarredNavigationForInit?.skipWorkspaceRestore === true;
      const skipWorkspaceRestore =
        Boolean(launchNotePath) || shouldSkipWorkspaceRestore || hasPendingOpenMarkdownTarget;
      await Promise.all([
        loadStarred(currentNotesRootPath),
        loadFileTree(skipWorkspaceRestore),
        cleanupAssetTempFiles(),
      ]);

      if (!cancelled) {
        await unlockWindow();
      }

      if (!cancelled) {
        onInitializingChange?.(false);
      }
    };

    void initializeNotesRoot().catch(() => {
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
    currentNotesRootPath,
    launchNotePath,
    pendingStarredNavigationToken,
    pendingOpenMarkdownTargetToken,
    loadStarred,
    loadFileTree,
    cleanupAssetTempFiles,
    clearAssetUrlCache,
    clearRemoteImageMemoryCache,
    cancelNoteContentScan,
    onInitializingChange,
  ]);
}
