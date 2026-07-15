import { useEffect, useRef } from 'react';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { themeEditorLayoutTokens } from '@/styles/themeTokens';
import { useBlankWorkspaceDropOpen } from './hooks/useBlankWorkspaceDropOpen';
import { useNotesSidebarExternalDropImport } from './hooks/useNotesSidebarExternalDropImport';
import { hasFileTreeNoteFiles, shouldAutoCreateBlankDraft } from './autoCreateBlankDraftPolicy';

export function useNotesBlankWorkspaceDropLifecycle(args: {
  active: boolean;
  blankDropDraftHasUnsavedChanges: boolean;
  currentNotePath: string | undefined;
  currentNotesRoot: { path: string } | null | undefined;
  draftNotes: ReturnType<typeof useNotesStore.getState>['draftNotes'];
  isLoading: boolean;
  isNotesRootInitializing: boolean;
  isOpenTargetBusy: boolean;
  launchNotePath: string | null;
  loadFileTree: ReturnType<typeof useNotesStore.getState>['loadFileTree'];
  notesPath: string;
  notesRootInitializing: boolean;
  notesRootStoreHasInitialized: boolean;
  openMarkdownTarget: (absolutePath: string) => Promise<unknown>;
  openNotesRoot: (path: string) => Promise<boolean>;
  openTabs: ReturnType<typeof useNotesStore.getState>['openTabs'];
  pendingStarredNavigation: ReturnType<typeof useNotesStore.getState>['pendingStarredNavigation'];
  revealFolder: ReturnType<typeof useNotesStore.getState>['revealFolder'];
  rootFolder: ReturnType<typeof useNotesStore.getState>['rootFolder'];
  rootFolderPath: string | null;
}) {
  const {
    active,
    blankDropDraftHasUnsavedChanges,
    currentNotePath,
    currentNotesRoot,
    draftNotes,
    isLoading,
    isNotesRootInitializing,
    isOpenTargetBusy,
    launchNotePath,
    loadFileTree,
    notesPath,
    notesRootInitializing,
    notesRootStoreHasInitialized,
    openMarkdownTarget,
    openNotesRoot,
    openTabs,
    pendingStarredNavigation,
    revealFolder,
    rootFolder,
    rootFolderPath,
  } = args;
  const autoCreateBlankNoteRef = useRef(false);
  const hasPresentedNoteRef = useRef(false);
  const autoCreateNotesRootPathRef = useRef<string | null>(currentNotesRoot?.path ?? null);

  const acceptsBlankWorkspaceDrop = (() => {
    if (!currentNotePath) {
      return openTabs.length === 0;
    }

    if (!isDraftNotePath(currentNotePath)) {
      return false;
    }

    if (openTabs.length !== 1 || openTabs[0]?.path !== currentNotePath) {
      return false;
    }

    const draftEntry = draftNotes[currentNotePath];
    if (!draftEntry) {
      return false;
    }

    return !blankDropDraftHasUnsavedChanges;
  })();

  const isBlankWorkspaceDropActive = useBlankWorkspaceDropOpen({
    enabled: active && acceptsBlankWorkspaceDrop && !isOpenTargetBusy,
    openMarkdownTarget,
    openNotesRoot,
  });

  useEffect(() => {
    if (currentNotePath || openTabs.length > 0) {
      hasPresentedNoteRef.current = true;
    }
  }, [currentNotePath, openTabs.length]);

  useEffect(() => {
    const notesRootPath = currentNotesRoot?.path ?? null;
    if (autoCreateNotesRootPathRef.current === notesRootPath) {
      return;
    }

    autoCreateNotesRootPathRef.current = notesRootPath;
    hasPresentedNoteRef.current = false;
    autoCreateBlankNoteRef.current = false;
  }, [currentNotesRoot?.path]);

  useEffect(() => {
    const launchNoteBlocked = Boolean(launchNotePath);
    const policy = shouldAutoCreateBlankDraft({
      active,
      currentNotePath,
      openTabCount: openTabs.length,
      hasPresentedNote: hasPresentedNoteRef.current,
      notesLoading: isLoading,
      notesRootStoreHasInitialized,
      notesRootInitializing: isNotesRootInitializing || notesRootInitializing,
      openTargetBusy: isOpenTargetBusy,
      hasPendingStarredNavigation: Boolean(pendingStarredNavigation),
      autoCreateInFlight: autoCreateBlankNoteRef.current,
      hasPendingLaunchNote: launchNoteBlocked,
      currentNotesRootPath: currentNotesRoot?.path ?? null,
      notesPath,
      rootFolder,
      rootFolderPath,
    });

    if (!policy.shouldCreate) {
      return;
    }

    autoCreateBlankNoteRef.current = true;

    const timeoutId = window.setTimeout(() => {
      const state = useNotesStore.getState();
      const timerRootFolderCurrent = Boolean(
        currentNotesRoot &&
        state.rootFolder &&
        state.rootFolderPath === currentNotesRoot.path &&
        state.notesPath === currentNotesRoot.path
      );
      if (state.currentNote || state.openTabs.length > 0) {
        autoCreateBlankNoteRef.current = false;
        return;
      }
      if (currentNotesRoot && !timerRootFolderCurrent) {
        autoCreateBlankNoteRef.current = false;
        return;
      }
      if (currentNotesRoot && timerRootFolderCurrent && hasFileTreeNoteFiles(state.rootFolder)) {
        autoCreateBlankNoteRef.current = false;
        return;
      }

      void state.createNote(undefined, { asDraft: true })
        .catch((_error) => {
          autoCreateBlankNoteRef.current = false;
        });
    }, themeEditorLayoutTokens.autoCreateBlankDraftDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
      autoCreateBlankNoteRef.current = false;
    };
  }, [
    active,
    currentNotePath,
    currentNotesRoot,
    isLoading,
    notesRootStoreHasInitialized,
    isNotesRootInitializing,
    notesRootInitializing,
    isOpenTargetBusy,
    openTabs.length,
    pendingStarredNavigation,
    rootFolder,
    rootFolderPath,
    notesPath,
    launchNotePath,
  ]);

  useNotesSidebarExternalDropImport({
    enabled: active && !acceptsBlankWorkspaceDrop && Boolean(
      currentNotesRoot?.path &&
      rootFolder &&
      rootFolderPath === currentNotesRoot.path &&
      notesPath === currentNotesRoot.path
    ),
    notesRootPath: currentNotesRoot?.path ?? '',
    loadFileTree,
    revealFolder,
  });

  return { isBlankWorkspaceDropActive };
}
