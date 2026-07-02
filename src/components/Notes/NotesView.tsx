import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import {
  NOTES_CHAT_FLOATING_DEFAULT_SIZE,
  NOTES_CHAT_FLOATING_MAX_SIZE,
  NOTES_CHAT_FLOATING_MIN_SIZE,
  type NotesChatFloatingSize,
  useUIStore,
} from '@/stores/uiSlice';
import { useToastStore } from '@/stores/useToastStore';
import { ResizablePanel } from '@/components/layout/ResizablePanel';
import { useResizableBox } from '@/components/layout/shell/useResizableBox';
import { ModuleShortcutsDialog } from '@/components/common/ModuleShortcutsDialog';
import { readWindowLaunchContext } from '@/lib/desktop/launchContext';
import { useNotesViewShortcuts } from './hooks/useNotesViewShortcuts';
import { useModuleShortcutsDialog } from '@/hooks/useModuleShortcutsDialog';
import { useCurrentNotesRootExternalPathSync } from './hooks/useCurrentNotesRootExternalPathSync';
import { useCurrentNotesRootInitialization } from './hooks/useCurrentNotesRootInitialization';
import { useNotesChatComposerFocus } from './hooks/useNotesChatComposerFocus';
import { useAbsoluteNoteExternalRenameSync } from './hooks/useAbsoluteNoteExternalRenameSync';
import { useNotesExternalSync } from './hooks/useNotesExternalSync';
import { useNotesOpenMarkdownTarget } from './hooks/useNotesOpenMarkdownTarget';
import { openStoredNotePath } from '@/stores/notes/openNotePath';
import { hasDraftUnsavedChanges, isDraftNotePath } from '@/stores/notes/draftNote';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { BlurBackdrop } from '@/components/common/BlurBackdrop';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { TreeItemDeleteDialog } from '@/components/Notes/features/FileTree/components/TreeItemDeleteDialog';
import { subscribeDeleteCurrentNoteEvent } from '@/components/Notes/noteDeleteEvents';
import { useBlankWorkspaceDropOpen } from './hooks/useBlankWorkspaceDropOpen';
import { useNotesSidebarExternalDropImport } from './hooks/useNotesSidebarExternalDropImport';
import { collectNotePathsInTreeOrder } from './features/common/noteTreeNavigation';
import { useI18n } from '@/lib/i18n';
import { normalizeUserFacingErrorMessage } from '@/lib/i18n/userFacingErrors';
import { clearRemoteImageMemoryCache } from './features/Editor/plugins/image-block/utils/remoteImageMemoryCache';
import { preloadMarkdownEditor } from './features/Editor/preloadMarkdownEditor';
import { focusNoteTitleInputAtEnd } from './features/Editor/utils/titleInputDom';
import {
  LargeMarkdownFirstPaintPreview,
  createLargeMarkdownFirstPaintPreviewBlocks,
} from './features/Editor/LargeMarkdownFirstPaintPreview';
import { hasFileTreeNoteFiles, shouldAutoCreateBlankDraft } from './autoCreateBlankDraftPolicy';
import { cn } from '@/lib/utils';
import { requestNativeCaretOverlayRefresh } from '@/hooks/useNativeCaretOverlay';
import { themeBackdropTokens, themeEditorLayoutTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';
import type { NoteMetadataEntry } from '@/stores/notes/types';

let embeddedChatViewModulePromise: Promise<typeof import('@/components/Chat/ChatView')> | null = null;
let embeddedChatViewModuleReady = false;

function preloadEmbeddedChatViewModule() {
  embeddedChatViewModulePromise ??= import('@/components/Chat/ChatView').then((mod) => {
    embeddedChatViewModuleReady = true;
    return mod;
  });
  return embeddedChatViewModulePromise;
}

const EmbeddedChatView = lazy(async () => {
  const mod = await preloadEmbeddedChatViewModule();
  return { default: mod.ChatView };
});

const MarkdownEditor = lazy(async () => {
  const mod = await preloadMarkdownEditor();
  return { default: mod.MarkdownEditor };
});

const FLOATING_CHAT_VIEWPORT_MARGIN_PX = 32;

function scheduleSidebarScroll(path: string): void {
  void import('./features/common/sidebarScrollIntoView')
    .then((mod) => {
      mod.scheduleSidebarItemIntoView(path, 2);
    });
}

function isEmptyUntitledDraft({
  content,
  draftMetadata,
  draftNotes,
  path,
}: {
  content: string;
  draftMetadata?: NoteMetadataEntry;
  draftNotes: ReturnType<typeof useNotesStore.getState>['draftNotes'];
  path: string | null | undefined;
}): boolean {
  if (!path || !isDraftNotePath(path)) {
    return false;
  }

  const draftEntry = draftNotes[path];
  if (!draftEntry) {
    return false;
  }

  return !hasDraftUnsavedChanges({
    draftName: draftEntry.name,
    content,
    metadata: draftMetadata,
  });
}

export function NotesView({
  active = true,
  onStartupReady,
  onPrimaryContentReady,
}: {
  active?: boolean;
  onStartupReady?: () => void;
  onPrimaryContentReady?: () => void;
}) {
  const { t } = useI18n();
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const loadFileTree = useNotesStore(s => s.loadFileTree);
  const openTabs = useNotesStore(s => s.openTabs);
  const closeTab = useNotesStore(s => s.closeTab);
  const reopenClosedTab = useNotesStore(s => s.reopenClosedTab);
  const openNote = useNotesStore(s => s.openNote);
  const loadStarred = useNotesStore(s => s.loadStarred);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const saveNote = useNotesStore(s => s.saveNote);
  const cleanupAssetTempFiles = useNotesStore(s => s.cleanupAssetTempFiles);
  const clearAssetUrlCache = useNotesStore(s => s.clearAssetUrlCache);
  const cancelNoteContentScan = useNotesStore(s => s.cancelNoteContentScan);
  const revealFolder = useNotesStore(s => s.revealFolder);
  const isDirty = useNotesStore(s => s.isDirty);
  const pendingStarredNavigation = useNotesStore(s => s.pendingStarredNavigation);
  const setPendingStarredNavigation = useNotesStore(s => s.setPendingStarredNavigation);
  const notesPath = useNotesStore(s => s.notesPath);
  const rootFolder = useNotesStore(s => s.rootFolder);
  const rootFolderPath = useNotesStore(s => s.rootFolderPath);
  const isLoading = useNotesStore(s => s.isLoading);
  const unifiedLoaded = useUnifiedStore((s) => s.loaded);
  const draftNotes = useNotesStore(s => s.draftNotes);
  const currentDraftMetadata = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath || !isDraftNotePath(currentNotePath)) {
        return undefined;
      }
      return state.noteMetadata?.notes[currentNotePath];
    }, [currentNotePath])
  );
  const openNoteByAbsolutePath = useNotesStore(s => s.openNoteByAbsolutePath);
  const adoptAbsoluteNoteIntoNotesRoot = useNotesStore(s => s.adoptAbsoluteNoteIntoNotesRoot);
  const pendingDraftDiscardPath = useNotesStore(s => s.pendingDraftDiscardPath);
  const cancelPendingDraftDiscard = useNotesStore(s => s.cancelPendingDraftDiscard);
  const confirmPendingDraftDiscard = useNotesStore(s => s.confirmPendingDraftDiscard);
  const getDisplayName = useNotesStore(s => s.getDisplayName);
  const notesError = useNotesStore(s => s.error);
  const addToast = useToastStore(s => s.addToast);
  const blankDropDraftContent = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath || !isDraftNotePath(currentNotePath)) {
        return '';
      }
      if (openTabs.length !== 1 || openTabs[0]?.path !== currentNotePath) {
        return '';
      }
      return state.currentNote?.path === currentNotePath ? state.currentNote.content : '';
    }, [currentNotePath, openTabs])
  );

  const currentNotesRoot = useNotesRootStore((state) => state.currentNotesRoot);
  const openNotesRoot = useNotesRootStore((state) => state.openNotesRoot);
  const notesRootStoreHasInitialized = useNotesRootStore((state) => state.hasInitialized);
  const chatPanelCollapsed = useUIStore((s) => s.notesChatPanelCollapsed);
  const setChatPanelCollapsed = useUIStore((s) => s.setNotesChatPanelCollapsed);
  const chatFloatingOpen = useUIStore((s) => s.notesChatFloatingOpen);
  const setChatFloatingOpen = useUIStore((s) => s.setNotesChatFloatingOpen);
  const chatFloatingSize = useUIStore((s) => s.notesChatFloatingSize);
  const setChatFloatingSize = useUIStore((s) => s.setNotesChatFloatingSize);
  const resetChatFloatingSize = useUIStore((s) => s.resetNotesChatFloatingSize);
  const setLayoutPanelDragging = useUIStore((s) => s.setLayoutPanelDragging);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [pendingDeleteCurrentNotePath, setPendingDeleteCurrentNotePath] = useState<string | null>(null);
  const [isNotesRootInitializing, setIsNotesRootInitializing] = useState(false);
  const [isEmbeddedChatViewReady, setIsEmbeddedChatViewReady] = useState(embeddedChatViewModuleReady);
  const launchContextRef = useRef(readWindowLaunchContext());
  const notesViewRef = useRef<HTMLDivElement>(null);
  const floatingChatPanelRef = useRef<HTMLDivElement>(null);
  const chatPanelCaretRefreshFrameRef = useRef<number | null>(null);
  const hasHandledLaunchNoteRef = useRef(false);
  const autoCreateBlankNoteRef = useRef(false);
  const hasPresentedNoteRef = useRef(false);
  const previousActiveRef = useRef(active);
  const lastPresentedNotesErrorRef = useRef<string | null>(null);
  const autoCreateNotesRootPathRef = useRef<string | null>(currentNotesRoot?.path ?? null);
  const notesRootInitializingRef = useRef(false);
  const consumedPendingStarredNavigationKeyRef = useRef<string | null>(null);
  const [canLoadMarkdownEditor, setCanLoadMarkdownEditor] = useState(() => active);
  const [primaryContentReadyPath, setPrimaryContentReadyPath] = useState<string | null>(null);
  const toggleShortcutsDialog = useCallback(() => setIsShortcutsOpen((prev) => !prev), []);
  const handleNotesRootInitializingChange = useCallback((initializing: boolean) => {
    notesRootInitializingRef.current = initializing;
    setIsNotesRootInitializing(initializing);
  }, []);
  const closeFloatingChat = useCallback(() => {
    setChatFloatingOpen(false);
  }, [setChatFloatingOpen]);
  const closeChatPanel = useCallback(() => {
    setChatPanelCollapsed(true);
  }, [setChatPanelCollapsed]);
  const openFloatingChat = useCallback(() => {
    void preloadEmbeddedChatViewModule().catch(() => undefined);
    setChatPanelCollapsed(true);
    setChatFloatingOpen(true);
  }, [setChatFloatingOpen, setChatPanelCollapsed]);
  const promoteFloatingChatToSidePanel = useCallback(() => {
    setChatFloatingOpen(false);
    setChatPanelCollapsed(false);
  }, [setChatFloatingOpen, setChatPanelCollapsed]);
  const handleChatPanelDragStateChange = useCallback((dragging: boolean) => {
    setLayoutPanelDragging(dragging);
  }, [setLayoutPanelDragging]);
  const getDockedChatPanelMaxWidth = useCallback((): number => {
    const container = notesViewRef.current;
    const containerWidth = container?.clientWidth || window.innerWidth;
    const availableWidth = Math.max(0, containerWidth - FLOATING_CHAT_VIEWPORT_MARGIN_PX);

    return availableWidth || 760;
  }, []);
  const scheduleChatPanelCaretRefresh = useCallback(() => {
    if (chatPanelCaretRefreshFrameRef.current !== null) {
      return;
    }

    chatPanelCaretRefreshFrameRef.current = window.requestAnimationFrame(() => {
      chatPanelCaretRefreshFrameRef.current = null;
      requestNativeCaretOverlayRefresh();
    });
  }, []);
  const [floatingChatLiveSize, setFloatingChatLiveSize] = useState<NotesChatFloatingSize>(chatFloatingSize);
  const applyFloatingChatLiveSize = useCallback((nextSize: NotesChatFloatingSize) => {
    const panel = floatingChatPanelRef.current;
    if (!panel) {
      return;
    }

    panel.style.width = `${nextSize.width}px`;
    panel.style.height = `${nextSize.height}px`;
  }, []);
  const handleFloatingChatLiveSizeChange = useCallback((nextSize: NotesChatFloatingSize) => {
    applyFloatingChatLiveSize(nextSize);
    requestNativeCaretOverlayRefresh();
  }, [applyFloatingChatLiveSize]);
  const getFloatingChatMaxSize = useCallback((): NotesChatFloatingSize => {
    const container = notesViewRef.current;
    const containerWidth = container?.clientWidth || window.innerWidth;
    const containerHeight = container?.clientHeight || window.innerHeight;
    const availableWidth = Math.max(0, containerWidth - FLOATING_CHAT_VIEWPORT_MARGIN_PX);
    const availableHeight = Math.max(0, containerHeight - FLOATING_CHAT_VIEWPORT_MARGIN_PX);

    return {
      width: availableWidth || NOTES_CHAT_FLOATING_MAX_SIZE.width,
      height: availableHeight || NOTES_CHAT_FLOATING_MAX_SIZE.height,
    };
  }, []);
  const handleFloatingChatSizeCommit = useCallback((nextSize: NotesChatFloatingSize) => {
    applyFloatingChatLiveSize(nextSize);
    setFloatingChatLiveSize(nextSize);
    setChatFloatingSize(nextSize);
  }, [applyFloatingChatLiveSize, setChatFloatingSize]);
  const {
    isDragging: isFloatingChatResizing,
    handleResizeStart: beginFloatingChatResize,
  } = useResizableBox<NotesChatFloatingSize>({
    size: floatingChatLiveSize,
    minSize: NOTES_CHAT_FLOATING_MIN_SIZE,
    maxSize: NOTES_CHAT_FLOATING_MAX_SIZE,
    defaultSize: NOTES_CHAT_FLOATING_DEFAULT_SIZE,
    getMaxSize: getFloatingChatMaxSize,
    onSizeChange: handleFloatingChatLiveSizeChange,
    onSizeCommit: handleFloatingChatSizeCommit,
    onDragStateChange: handleChatPanelDragStateChange,
    liveUpdateMode: 'sync',
    allowDoubleClickReset: false,
  });
  const notePathsInTreeOrder = useMemo(() => (
    rootFolder && rootFolderPath === notesPath ? collectNotePathsInTreeOrder(rootFolder.children) : []
  ), [notesPath, rootFolder, rootFolderPath]);

  const focusSidebarPath = useCallback((path: string) => {
    revealFolder(path);
    scheduleSidebarScroll(path);
  }, [revealFolder]);

  const focusNotesChatComposer = useNotesChatComposerFocus(setChatPanelCollapsed);

  useEffect(() => {
    onStartupReady?.();
  }, [currentNotePath, currentNotesRoot, isLoading, onStartupReady, openTabs.length]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    void preloadEmbeddedChatViewModule().then(() => {
      if (!cancelled) {
        setIsEmbeddedChatViewReady(true);
      }
    }).catch(() => undefined);

    const timeoutId = window.setTimeout(() => {
      void preloadMarkdownEditor().catch(() => undefined);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [active]);

  useEffect(() => {
    const wasActive = previousActiveRef.current;
    previousActiveRef.current = active;
    if (!active || wasActive) {
      return;
    }

    if (
      openTabs.length !== 1 ||
      openTabs[0]?.path !== currentNotePath ||
      !isEmptyUntitledDraft({
        content: currentNoteContent,
        draftMetadata: currentDraftMetadata,
        draftNotes,
        path: currentNotePath,
      })
    ) {
      return;
    }

    let cancelled = false;
    let nextFrameId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      nextFrameId = window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }
        if (focusNoteTitleInputAtEnd(notesViewRef.current ?? document)) {
          requestNativeCaretOverlayRefresh();
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      if (nextFrameId !== null) {
        window.cancelAnimationFrame(nextFrameId);
      }
    };
  }, [active, currentDraftMetadata, currentNoteContent, currentNotePath, draftNotes, openTabs]);

  const reportNotesPrimaryContentReady = useCallback(() => {
    setPrimaryContentReadyPath(currentNotePath ?? null);
    onPrimaryContentReady?.();
  }, [currentNotePath, onPrimaryContentReady]);

  useEffect(() => {
    if (!currentNotePath || primaryContentReadyPath === currentNotePath) {
      return;
    }

    setPrimaryContentReadyPath(null);
  }, [currentNotePath, primaryContentReadyPath]);

  const firstPaintPreviewBlocks = useMemo(() => {
    if (!active || !currentNotePath || primaryContentReadyPath === currentNotePath) {
      return [];
    }

    return createLargeMarkdownFirstPaintPreviewBlocks(currentNoteContent);
  }, [active, currentNoteContent, currentNotePath, primaryContentReadyPath]);

  useEffect(() => {
    setCanLoadMarkdownEditor(active || Boolean(currentNotePath));
  }, [active, currentNotePath]);

  const {
    isOpenTargetBusy,
    openMarkdownTarget,
    pendingOpenMarkdownTargetNotesRootPath,
  } = useNotesOpenMarkdownTarget({
    active,
    currentNotesRootPath: currentNotesRoot?.path ?? null,
    notesPath,
    currentNotePath,
    isDirty,
    saveNote,
    openNote,
    openNoteByAbsolutePath,
    adoptAbsoluteNoteIntoNotesRoot,
    openNotesRoot,
  });

  useModuleShortcutsDialog({ enabled: active, onToggle: toggleShortcutsDialog });

  useEffect(() => {
    if (isFloatingChatResizing) {
      return;
    }

    applyFloatingChatLiveSize(chatFloatingSize);
    setFloatingChatLiveSize((current) => (
      current.width === chatFloatingSize.width && current.height === chatFloatingSize.height
        ? current
        : chatFloatingSize
    ));
  }, [applyFloatingChatLiveSize, chatFloatingSize, isFloatingChatResizing]);

  useLayoutEffect(() => {
    if (!active || !chatPanelCollapsed || !chatFloatingOpen) {
      return;
    }
    requestNativeCaretOverlayRefresh();
  }, [active, chatFloatingOpen, floatingChatLiveSize.height, floatingChatLiveSize.width, chatPanelCollapsed]);

  useEffect(() => {
    if (!notesError) {
      lastPresentedNotesErrorRef.current = null;
      return;
    }

    if (!active || lastPresentedNotesErrorRef.current === notesError) {
      return;
    }

    lastPresentedNotesErrorRef.current = notesError;
    addToast(normalizeUserFacingErrorMessage(notesError), 'error', themeUiFeedbackTokens.errorToastDurationMs);
  }, [active, addToast, notesError]);

  const activeNotesRootPath = active ? currentNotesRoot?.path ?? null : null;
  useCurrentNotesRootExternalPathSync(activeNotesRootPath);
  useNotesExternalSync(activeNotesRootPath, active ? notesPath : '');
  useAbsoluteNoteExternalRenameSync(active ? currentNotePath : undefined);
  useCurrentNotesRootInitialization({
    currentNotesRootPath: currentNotesRoot?.path ?? null,
    launchNotePath: launchContextRef.current.notePath,
    pendingStarredNavigation,
    pendingOpenMarkdownTargetNotesRootPath,
    loadStarred,
    loadFileTree,
    cleanupAssetTempFiles,
    clearAssetUrlCache,
    clearRemoteImageMemoryCache,
    cancelNoteContentScan,
    onInitializingChange: handleNotesRootInitializingChange,
  });

  useEffect(() => {
    if (hasHandledLaunchNoteRef.current) return;

    const { folderPath: launchFolderPath, notePath: launchNotePath } = launchContextRef.current;
    if ((!launchFolderPath && !launchNotePath) || !currentNotesRoot || notesPath !== currentNotesRoot.path) return;

    hasHandledLaunchNoteRef.current = true;
    if (launchFolderPath) {
      focusSidebarPath(launchFolderPath);
      return;
    }

    if (!launchNotePath) return;

    void openStoredNotePath(launchNotePath, {
      openNote,
      openNoteByAbsolutePath,
    })
      .catch((_error) => {
      });
  }, [currentNotesRoot, focusSidebarPath, notesPath, openNote, openNoteByAbsolutePath]);

  useEffect(() => {
    if (!currentNotesRoot || !pendingStarredNavigation) return;
    if (pendingStarredNavigation.notesRootPath !== currentNotesRoot.path) return;
    if (notesPath !== currentNotesRoot.path || !rootFolder || rootFolderPath !== currentNotesRoot.path) return;
    const pendingNavigationKey = [
      pendingStarredNavigation.notesRootPath,
      pendingStarredNavigation.kind,
      pendingStarredNavigation.relativePath,
      pendingStarredNavigation.openInNewTab ? 'new-tab' : 'same-tab',
    ].join('\n');
    if (consumedPendingStarredNavigationKeyRef.current === pendingNavigationKey) {
      return;
    }
    consumedPendingStarredNavigationKeyRef.current = pendingNavigationKey;

    const navigateToStarredTarget = async () => {
      setPendingStarredNavigation(null);
      if (pendingStarredNavigation.kind === 'folder') {
        revealFolder(pendingStarredNavigation.relativePath);
        scheduleSidebarScroll(pendingStarredNavigation.relativePath);
      } else {
        revealFolder(pendingStarredNavigation.relativePath);
        await openNote(
          pendingStarredNavigation.relativePath,
          pendingStarredNavigation.openInNewTab ?? false
        );
        scheduleSidebarScroll(pendingStarredNavigation.relativePath);
      }
    };

    void navigateToStarredTarget().catch(() => undefined);
  }, [
    currentNotesRoot,
    pendingStarredNavigation,
    notesPath,
    rootFolder,
    rootFolderPath,
    revealFolder,
    openNote,
    setPendingStarredNavigation,
  ]);

  useEffect(() => {
    if (pendingStarredNavigation) {
      return;
    }
    consumedPendingStarredNavigationKeyRef.current = null;
  }, [pendingStarredNavigation]);

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

    return !hasDraftUnsavedChanges({
      draftName: draftEntry.name,
      content: blankDropDraftContent,
      metadata: currentDraftMetadata,
    });
  })();

  const blankWorkspaceDropEnabled = active && acceptsBlankWorkspaceDrop && !isOpenTargetBusy;

  const isBlankWorkspaceDropActive = useBlankWorkspaceDropOpen({
    enabled: blankWorkspaceDropEnabled,
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
    const launchNoteBlocked = Boolean(launchContextRef.current.notePath && !hasHandledLaunchNoteRef.current);
    const policy = shouldAutoCreateBlankDraft({
      active,
      currentNotePath,
      openTabCount: openTabs.length,
      hasPresentedNote: hasPresentedNoteRef.current,
      notesLoading: isLoading,
      notesRootStoreHasInitialized,
      notesRootInitializing: isNotesRootInitializing || notesRootInitializingRef.current,
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
    isOpenTargetBusy,
    openTabs.length,
    pendingStarredNavigation,
    rootFolder,
    rootFolderPath,
    notesPath,
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

  useEffect(() => () => {
    if (chatPanelCaretRefreshFrameRef.current !== null) {
      window.cancelAnimationFrame(chatPanelCaretRefreshFrameRef.current);
      chatPanelCaretRefreshFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return subscribeDeleteCurrentNoteEvent(() => {
      if (!currentNotePath) {
        return;
      }
      setPendingDeleteCurrentNotePath(currentNotePath);
    });
  }, [currentNotePath]);

  useNotesViewShortcuts({
    active,
    currentNotePath,
    openTabs,
    notePathsInTreeOrder,
    openNote,
    closeTab,
    reopenClosedTab,
    chatPanelCollapsed,
    chatFloatingOpen,
    closeChatPanel,
    closeFloatingChat,
    openFloatingChat,
    focusNotesChatComposer,
    focusSidebarPath,
  });

  return (
    <>
      <AnimatePresence>
        {isBlankWorkspaceDropActive && (
          <BlurBackdrop
            className="pointer-events-none"
            overlayClassName="bg-[var(--vlaina-color-drop-overlay)]"
            zIndex={themeBackdropTokens.notesBlankWorkspaceDropZIndex}
            blurPx={themeBackdropTokens.notesBlankWorkspaceDropBlurPx}
            duration={themeBackdropTokens.notesBlankWorkspaceDropDurationSeconds}
            data-testid="blank-workspace-drop-overlay"
          />
        )}
      </AnimatePresence>

      <div ref={notesViewRef} data-notes-view-mode="true" className="h-full w-full relative flex min-w-0">
        <div className="flex-1 min-w-0 relative">
          {firstPaintPreviewBlocks.length > 0 ? (
            <div className="absolute inset-x-0 top-0 z-[var(--vlaina-z-1)] flex justify-center pointer-events-none">
              <LargeMarkdownFirstPaintPreview blocks={firstPaintPreviewBlocks} />
            </div>
          ) : null}

          {canLoadMarkdownEditor ? (
            <Suspense fallback={null}>
              <MarkdownEditor
                active={active}
                onEditorViewReady={reportNotesPrimaryContentReady}
              />
            </Suspense>
          ) : null}
        </div>

        {active && !chatPanelCollapsed && (
          <ResizablePanel
            defaultWidth={320}
            minWidth={320}
            maxWidth={760}
            getMaxWidth={getDockedChatPanelMaxWidth}
            storageKey="vlaina_notes_chat_panel_width_v2"
            onWidthChange={scheduleChatPanelCaretRefresh}
            onDragStateChange={handleChatPanelDragStateChange}
            className="h-full border-l border-[var(--vlaina-color-border-shell)] bg-[var(--vlaina-bg-primary)]"
          >
            <div data-notes-chat-panel="true" className="h-full min-h-0 relative">
              <Suspense fallback={null}>
                <EmbeddedChatView
                  mode="embedded"
                  active={active}
                  onCloseEmbeddedPanel={() => setChatPanelCollapsed(true)}
                />
              </Suspense>
            </div>
          </ResizablePanel>
        )}

        {active && chatPanelCollapsed && chatFloatingOpen && isEmbeddedChatViewReady && unifiedLoaded && (
          <Suspense fallback={null}>
            <div
              ref={floatingChatPanelRef}
              data-notes-chat-floating="true"
              className={cn(
                'absolute bottom-4 right-4 z-[var(--vlaina-z-40)] overflow-hidden !rounded-[var(--vlaina-radius-26px)]',
                isFloatingChatResizing && 'will-change-[width,height]',
                chatComposerPillSurfaceClass,
              )}
              style={{
                width: `${floatingChatLiveSize.width}px`,
                height: `${floatingChatLiveSize.height}px`,
                maxWidth: 'calc(100% - var(--vlaina-size-32px))',
                maxHeight: 'calc(100% - var(--vlaina-size-32px))',
              }}
            >
              <div
                aria-hidden="true"
                data-notes-chat-floating-resize-handle="left"
                className="absolute bottom-5 left-0 top-5 z-[var(--vlaina-z-50)] w-2 cursor-ew-resize touch-none bg-transparent"
                onPointerDown={(event) => beginFloatingChatResize('left', event)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resetChatFloatingSize();
                }}
              />
              <div
                aria-hidden="true"
                data-notes-chat-floating-resize-handle="top"
                className="absolute left-5 right-5 top-0 z-[var(--vlaina-z-50)] h-2 cursor-ns-resize touch-none bg-transparent"
                onPointerDown={(event) => beginFloatingChatResize('top', event)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resetChatFloatingSize();
                }}
              />
              <div
                aria-hidden="true"
                data-notes-chat-floating-resize-handle="top-left"
                className="absolute left-0 top-0 z-[var(--vlaina-z-50)] h-4 w-4 cursor-nwse-resize touch-none bg-transparent"
                onPointerDown={(event) => beginFloatingChatResize('top-left', event)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  resetChatFloatingSize();
                }}
              />
              <EmbeddedChatView
                mode="embedded"
                active={active}
                onCloseEmbeddedPanel={closeFloatingChat}
                onPromoteEmbeddedPanel={promoteFloatingChatToSidePanel}
              />
            </div>
          </Suspense>
        )}

      </div>

      <TreeItemDeleteDialog
        open={Boolean(pendingDeleteCurrentNotePath)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteCurrentNotePath(null);
          }
        }}
        itemLabel={pendingDeleteCurrentNotePath ? getDisplayName(pendingDeleteCurrentNotePath) : ''}
        itemType="Note"
        onConfirm={() => {
          const path = pendingDeleteCurrentNotePath;
          setPendingDeleteCurrentNotePath(null);
          if (path) {
            void deleteNote(path).catch(() => undefined);
          }
        }}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDraftDiscardPath)}
        onClose={cancelPendingDraftDiscard}
        onConfirm={confirmPendingDraftDiscard}
        title={t('notes.discardDraftTitle')}
        description={t('notes.discardDraftDescription')}
        confirmText={t('notes.discard')}
        cancelText={t('common.cancel')}
        variant="danger"
      />

      <ModuleShortcutsDialog module="notes" open={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );}
