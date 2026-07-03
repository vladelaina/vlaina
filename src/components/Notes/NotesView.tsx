import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
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
import {
  focusCurrentEditorAtViewportPoint,
  type EditorViewportPoint,
} from './features/Editor/utils/focusEditorAtPoint';
import { NoteToolbarActions } from './features/Editor/NoteToolbarActions';
import {
  NotesSplitPaneChrome,
  NotesSplitDropOverlay,
  NotesSplitPreviewPane,
} from './features/Split/NotesSplitPreviewPane';
import { NotesSplitDiagnosticsButton } from './features/Split/NotesSplitDiagnosticsButton';
import { subscribeNotesTabSplitDrag, type NotesSplitDragSource } from './features/Split/notesSplitDragEvents';
import {
  countNotesSplitPreviewLeaves,
  createInitialNotesSplitPaneTree,
  findFirstNotesSplitPreviewLeaf,
  findNotesSplitPreviewLeafByPath,
  moveNotesSplitPaneLeaf,
  promoteNotesSplitPreviewLeafToPrimary,
  pruneNotesSplitPaneTree,
  resizeNotesSplitPaneTree,
  resolveNotesSplitDropDirection,
  splitNotesPaneTree,
  type NotesSplitOrientation,
  type NotesSplitPaneTree,
  type NotesSplitPreviewLeaf,
  type NotesSplitDirection,
} from './features/Split/notesSplitLayout';
import { logNotesSplitDiagnostic } from '@/lib/diagnostics/notesSplitDiagnostics';
import { hasFileTreeNoteFiles, shouldAutoCreateBlankDraft } from './autoCreateBlankDraftPolicy';
import { cn } from '@/lib/utils';
import { requestNativeCaretOverlayRefresh } from '@/hooks/useNativeCaretOverlay';
import { themeBackdropTokens, themeEditorLayoutTokens, themeUiFeedbackTokens } from '@/styles/themeTokens';
import type { NoteMetadataEntry } from '@/stores/notes/types';
import { findStarredEntryByPath } from '@/stores/notes/starred';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';

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
const SPLIT_PANE_DRAG_THRESHOLD_PX = 5;

type NotesSplitDropTarget = {
  leafId: string;
  direction: NotesSplitDirection;
};

type ActiveNotesSplitResize = {
  splitId: string;
  orientation: NotesSplitOrientation;
  container: HTMLElement;
  previousBodyCursor: string;
  previousBodyUserSelect: string;
};

type ActiveNotesSplitPaneDrag = {
  hasMoved: boolean;
  initialClientX: number;
  initialClientY: number;
  previousBodyCursor: string;
  previousBodyUserSelect: string;
  sourceLeafId: string;
};

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

function isNotePathOpenInLatestTabs(path: string): boolean {
  return useNotesStore.getState().openTabs.some((tab) => tab.path === path);
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
  const prefetchNote = useNotesStore(s => s.prefetchNote);
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
  const currentNoteStarred = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath) return false;
      return Boolean(findStarredEntryByPath(state.starredEntries, 'note', currentNotePath, state.notesPath));
    }, [currentNotePath])
  );
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const currentNoteMetadata = useNotesStore(
    useCallback((state) => {
      return getNoteMetadataEntry(state.noteMetadata, currentNotePath);
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
  const noteContentsCache = useNotesStore(s => s.noteContentsCache);
  const [splitPaneTree, setSplitPaneTree] = useState<NotesSplitPaneTree>(() => createInitialNotesSplitPaneTree());
  const [activeSplitPreviewLeafId, setActiveSplitPreviewLeafId] = useState<string | null>(null);
  const [primaryPreviewLeaf, setPrimaryPreviewLeaf] = useState<NotesSplitPreviewLeaf | null>(null);
  const [splitDropTarget, setSplitDropTarget] = useState<NotesSplitDropTarget | null>(null);
  const splitPaneTreeRef = useRef(splitPaneTree);
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
  const setNotesSplitPanesActive = useUIStore((s) => s.setNotesSplitPanesActive);

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [pendingDeleteCurrentNotePath, setPendingDeleteCurrentNotePath] = useState<string | null>(null);
  const [isNotesRootInitializing, setIsNotesRootInitializing] = useState(false);
  const [isEmbeddedChatViewReady, setIsEmbeddedChatViewReady] = useState(embeddedChatViewModuleReady);
  const launchContextRef = useRef(readWindowLaunchContext());
  const notesViewRef = useRef<HTMLDivElement>(null);
  const splitDropRootRef = useRef<HTMLDivElement>(null);
  const splitPaneIdSequenceRef = useRef(0);
  const activeSplitResizeRef = useRef<ActiveNotesSplitResize | null>(null);
  const activeSplitPaneDragRef = useRef<ActiveNotesSplitPaneDrag | null>(null);
  const stopSplitPaneDragRef = useRef<((event?: PointerEvent, commit?: boolean) => void) | null>(null);
  const pendingSplitEditorFocusRef = useRef<{
    path: string;
    point: EditorViewportPoint;
  } | null>(null);
  const floatingChatPanelRef = useRef<HTMLDivElement>(null);
  const chatPanelCaretRefreshFrameRef = useRef<number | null>(null);
  const currentNotePathRef = useRef<string | null>(currentNotePath ?? null);
  const activeSplitPreviewLeafIdRef = useRef<string | null>(activeSplitPreviewLeafId);
  const primaryPreviewLeafRef = useRef<NotesSplitPreviewLeaf | null>(primaryPreviewLeaf);
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

  const nextSplitPaneId = useCallback((prefix: 'preview' | 'split') => {
    splitPaneIdSequenceRef.current += 1;
    return `${prefix}:${splitPaneIdSequenceRef.current}`;
  }, []);

  useEffect(() => {
    splitPaneTreeRef.current = splitPaneTree;
  }, [splitPaneTree]);

  useEffect(() => {
    activeSplitPreviewLeafIdRef.current = activeSplitPreviewLeafId;
  }, [activeSplitPreviewLeafId]);

  useEffect(() => {
    primaryPreviewLeafRef.current = primaryPreviewLeaf;
  }, [primaryPreviewLeaf]);

  const hasSplitPanes = countNotesSplitPreviewLeaves(splitPaneTree) > 0;

  useEffect(() => {
    setNotesSplitPanesActive(active && hasSplitPanes);
    return () => setNotesSplitPanesActive(false);
  }, [active, hasSplitPanes, setNotesSplitPanesActive]);

  useEffect(() => {
    if (hasSplitPanes) return;
    setActiveSplitPreviewLeafId(null);
    setPrimaryPreviewLeaf(null);
  }, [hasSplitPanes]);

  useEffect(() => {
    const previousPath = currentNotePathRef.current;
    currentNotePathRef.current = currentNotePath ?? null;
    if (!currentNotePath || !previousPath || currentNotePath === previousPath) {
      return;
    }

    if (primaryPreviewLeafRef.current?.path === currentNotePath) {
      setActiveSplitPreviewLeafId(null);
      setPrimaryPreviewLeaf(null);
      return;
    }

    const targetLeaf = findNotesSplitPreviewLeafByPath(splitPaneTreeRef.current, currentNotePath);
    if (!targetLeaf) {
      setActiveSplitPreviewLeafId(null);
      setPrimaryPreviewLeaf(null);
      return;
    }

    if (!activeSplitPreviewLeafIdRef.current) {
      setPrimaryPreviewLeaf({
        type: 'preview',
        id: nextSplitPaneId('preview'),
        path: previousPath,
        requiresOpenTab: isNotePathOpenInLatestTabs(previousPath),
      });
    }
    setActiveSplitPreviewLeafId(targetLeaf.id);
  }, [currentNotePath, nextSplitPaneId]);

  const resolveSplitDropTarget = useCallback((detail: {
    path: string;
    clientX?: number;
    clientY?: number;
    sourceLeafId?: string;
  }): NotesSplitDropTarget | null => {
    if (
      !active ||
      detail.clientX === undefined ||
      detail.clientY === undefined
    ) {
      return null;
    }

    const dropRoot = splitDropRootRef.current;
    if (!dropRoot) {
      return null;
    }

    const point = {
      clientX: detail.clientX,
      clientY: detail.clientY,
    };
    const elements = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(point.clientX, point.clientY)
      : [];
    const leafElement = elements
      .map((element) => element instanceof HTMLElement
        ? element.closest<HTMLElement>('[data-notes-split-leaf-id]')
        : null)
      .find((element) => Boolean(
        element &&
        dropRoot.contains(element) &&
        element.dataset.notesSplitLeafId !== detail.sourceLeafId
      ));
    const fallbackLeafElement = Array.from(dropRoot.querySelectorAll<HTMLElement>('[data-notes-split-leaf-id]'))
      .find((element) => element.dataset.notesSplitLeafId !== detail.sourceLeafId);
    const targetElement = leafElement ?? fallbackLeafElement;
    if (!targetElement) {
      return null;
    }

    const direction = resolveNotesSplitDropDirection(targetElement.getBoundingClientRect(), point)
      ?? (leafElement ? null : resolveNotesSplitDropDirection(dropRoot.getBoundingClientRect(), point));
    if (!direction) {
      return null;
    }

    return {
      leafId: targetElement.dataset.notesSplitLeafId ?? '',
      direction,
    };
  }, [active]);

  const openSplitPane = useCallback((path: string, target: NotesSplitDropTarget, source: NotesSplitDragSource = 'tab') => {
    const insertPreview = () => {
      const previewLeaf: NotesSplitPreviewLeaf = {
        type: 'preview',
        id: nextSplitPaneId('preview'),
        path,
        requiresOpenTab: source !== 'sidebar',
      };
      setSplitPaneTree((currentTree) => splitNotesPaneTree(
        currentTree,
        target.leafId,
        previewLeaf,
        target.direction,
        nextSplitPaneId('split'),
      ));
    };

    const currentPath = currentNotePathRef.current;
    if (path === currentPath) {
      const fallbackTab = openTabs.find((tab) => tab.path !== path);
      if (fallbackTab) {
        void Promise.resolve(openStoredNotePath(fallbackTab.path, {
          openNote,
          openNoteByAbsolutePath,
        })).then(() => {
          insertPreview();
        });
        return;
      }
    }

    if (source === 'sidebar' && path !== currentPath) {
      void prefetchNote(path).finally(insertPreview);
      return;
    }

    insertPreview();
  }, [nextSplitPaneId, openNote, openNoteByAbsolutePath, openTabs, prefetchNote]);

  useEffect(() => {
    if (!active) {
      setSplitDropTarget(null);
      return;
    }

    return subscribeNotesTabSplitDrag((detail) => {
      if (detail.phase === 'move') {
        setSplitDropTarget(resolveSplitDropTarget(detail));
        return;
      }

      if (detail.phase === 'end') {
        const target = resolveSplitDropTarget(detail);
        setSplitDropTarget(null);
        if (target) {
          openSplitPane(detail.path, target, detail.source);
          return true;
        }
        return false;
      }

      setSplitDropTarget(null);
      return false;
    });
  }, [active, openSplitPane, resolveSplitDropTarget]);

  useEffect(() => {
    const openTabPaths = new Set(openTabs.map((tab) => tab.path));
    setSplitPaneTree((currentTree) => (
      pruneNotesSplitPaneTree(currentTree, (leaf) => (
        leaf.requiresOpenTab && !openTabPaths.has(leaf.path)
      )) ?? createInitialNotesSplitPaneTree()
    ));
  }, [openTabs]);

  const closeSplitPane = useCallback((leafId: string) => {
    setSplitPaneTree((currentTree) => (
      pruneNotesSplitPaneTree(currentTree, (leaf) => leaf.id === leafId) ?? createInitialNotesSplitPaneTree()
    ));
  }, []);

  const closePrimaryPreviewPane = useCallback(() => {
    const activePreviewLeafId = activeSplitPreviewLeafIdRef.current;
    if (!activePreviewLeafId) {
      return;
    }

    setSplitPaneTree((currentTree) => (
      promoteNotesSplitPreviewLeafToPrimary(currentTree, activePreviewLeafId) ?? createInitialNotesSplitPaneTree()
    ));
    setActiveSplitPreviewLeafId(null);
    setPrimaryPreviewLeaf(null);
  }, []);

  const applyPendingSplitEditorFocus = useCallback(() => {
    const pending = pendingSplitEditorFocusRef.current;
    const latestPath = useNotesStore.getState().currentNote?.path ?? null;
    if (!pending || pending.path !== latestPath) {
      return;
    }

    if (focusCurrentEditorAtViewportPoint(pending.point)) {
      pendingSplitEditorFocusRef.current = null;
    }
  }, []);

  const activateSplitPane = useCallback((leafId: string, path: string, point?: EditorViewportPoint) => {
    const previousPath = currentNotePathRef.current;
    logNotesSplitDiagnostic('split-activate-preview-start', {
      leafId,
      path,
      point: point ?? null,
      previousPath,
    });
    pendingSplitEditorFocusRef.current = point ? { path, point } : null;
    return Promise.resolve(openStoredNotePath(path, {
      openNote,
      openNoteByAbsolutePath,
    })).then(() => {
      if (previousPath && previousPath !== path) {
        if (!activeSplitPreviewLeafIdRef.current) {
          setPrimaryPreviewLeaf({
            type: 'preview',
            id: nextSplitPaneId('preview'),
            path: previousPath,
            requiresOpenTab: isNotePathOpenInLatestTabs(previousPath),
          });
        }
        setActiveSplitPreviewLeafId(leafId);
      }
      logNotesSplitDiagnostic('split-activate-preview-complete', {
        activeLeafId: leafId,
        currentPath: useNotesStore.getState().currentNote?.path ?? null,
        path,
        previousPath,
      });
      window.requestAnimationFrame(applyPendingSplitEditorFocus);
    });
  }, [applyPendingSplitEditorFocus, nextSplitPaneId, openNote, openNoteByAbsolutePath]);

  const activatePrimaryPreviewPane = useCallback((path: string, point?: EditorViewportPoint) => {
    logNotesSplitDiagnostic('split-activate-primary-preview-start', {
      path,
      point: point ?? null,
      previousPath: currentNotePathRef.current,
    });
    pendingSplitEditorFocusRef.current = point ? { path, point } : null;
    return Promise.resolve(openStoredNotePath(path, {
      openNote,
      openNoteByAbsolutePath,
    })).then(() => {
      setActiveSplitPreviewLeafId(null);
      setPrimaryPreviewLeaf(null);
      logNotesSplitDiagnostic('split-activate-primary-preview-complete', {
        currentPath: useNotesStore.getState().currentNote?.path ?? null,
        path,
      });
      window.requestAnimationFrame(applyPendingSplitEditorFocus);
    });
  }, [applyPendingSplitEditorFocus, openNote, openNoteByAbsolutePath]);

  const closeActiveSplitPane = useCallback(() => {
    const activePreviewLeafId = activeSplitPreviewLeafIdRef.current;
    if (activePreviewLeafId) {
      const restoreLeaf = primaryPreviewLeafRef.current ?? findFirstNotesSplitPreviewLeaf(splitPaneTreeRef.current);
      setSplitPaneTree((currentTree) => (
        pruneNotesSplitPaneTree(currentTree, (leaf) => leaf.id === activePreviewLeafId) ?? createInitialNotesSplitPaneTree()
      ));
      setActiveSplitPreviewLeafId(null);
      setPrimaryPreviewLeaf(null);
      if (restoreLeaf) {
        void Promise.resolve(openStoredNotePath(restoreLeaf.path, {
          openNote,
          openNoteByAbsolutePath,
        })).catch(() => undefined);
      }
      return;
    }

    const promotedLeaf = findFirstNotesSplitPreviewLeaf(splitPaneTreeRef.current);
    if (!promotedLeaf) {
      return;
    }

    setSplitPaneTree((currentTree) => (
      promoteNotesSplitPreviewLeafToPrimary(currentTree, promotedLeaf.id) ?? createInitialNotesSplitPaneTree()
    ));
    void Promise.resolve(openStoredNotePath(promotedLeaf.path, {
      openNote,
      openNoteByAbsolutePath,
    })).catch(() => undefined);
  }, [openNote, openNoteByAbsolutePath]);

  const updateSplitResizeRatio = useCallback((clientX: number, clientY: number) => {
    const resize = activeSplitResizeRef.current;
    if (!resize) {
      return;
    }

    const rect = resize.container.getBoundingClientRect();
    const size = resize.orientation === 'horizontal' ? rect.width : rect.height;
    if (size <= 0) {
      return;
    }

    const offset = resize.orientation === 'horizontal'
      ? clientX - rect.left
      : clientY - rect.top;
    setSplitPaneTree((currentTree) => resizeNotesSplitPaneTree(currentTree, resize.splitId, offset / size));
  }, []);

  const handleSplitResizePointerMove = useCallback((event: PointerEvent) => {
    if (!activeSplitResizeRef.current) {
      return;
    }

    event.preventDefault();
    updateSplitResizeRatio(event.clientX, event.clientY);
  }, [updateSplitResizeRatio]);

  const stopSplitResize = useCallback(() => {
    const resize = activeSplitResizeRef.current;
    if (!resize) {
      return;
    }

    document.removeEventListener('pointermove', handleSplitResizePointerMove, true);
    document.removeEventListener('pointerup', stopSplitResize, true);
    document.removeEventListener('pointercancel', stopSplitResize, true);
    document.body.style.cursor = resize.previousBodyCursor;
    document.body.style.userSelect = resize.previousBodyUserSelect;
    activeSplitResizeRef.current = null;
    setLayoutPanelDragging(false);
    requestNativeCaretOverlayRefresh();
  }, [handleSplitResizePointerMove, setLayoutPanelDragging]);

  const beginSplitResize = useCallback((
    splitId: string,
    orientation: NotesSplitOrientation,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (activeSplitResizeRef.current) {
      stopSplitResize();
    }

    activeSplitResizeRef.current = {
      splitId,
      orientation,
      container,
      previousBodyCursor: document.body.style.cursor,
      previousBodyUserSelect: document.body.style.userSelect,
    };
    document.body.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    setLayoutPanelDragging(true);
    updateSplitResizeRatio(event.clientX, event.clientY);
    document.addEventListener('pointermove', handleSplitResizePointerMove, true);
    document.addEventListener('pointerup', stopSplitResize, true);
    document.addEventListener('pointercancel', stopSplitResize, true);
  }, [handleSplitResizePointerMove, setLayoutPanelDragging, stopSplitResize, updateSplitResizeRatio]);

  useEffect(() => {
    return () => {
      stopSplitResize();
    };
  }, [stopSplitResize]);

  const handleSplitPaneDragPointerMove = useCallback((event: PointerEvent) => {
    const drag = activeSplitPaneDragRef.current;
    if (!drag) {
      return;
    }

    event.preventDefault();
    const distance = Math.hypot(
      event.clientX - drag.initialClientX,
      event.clientY - drag.initialClientY,
    );
    if (!drag.hasMoved && distance < SPLIT_PANE_DRAG_THRESHOLD_PX) {
      return;
    }

    drag.hasMoved = true;
    setSplitDropTarget(resolveSplitDropTarget({
      path: '',
      sourceLeafId: drag.sourceLeafId,
      clientX: event.clientX,
      clientY: event.clientY,
    }));
  }, [resolveSplitDropTarget]);

  const handleSplitPaneDragPointerUp = useCallback((event: PointerEvent) => {
    event.preventDefault();
    stopSplitPaneDragRef.current?.(event, true);
  }, []);

  const handleSplitPaneDragPointerCancel = useCallback(() => {
    stopSplitPaneDragRef.current?.();
  }, []);

  const stopSplitPaneDrag = useCallback((
    event?: PointerEvent,
    commit = false,
  ) => {
    const drag = activeSplitPaneDragRef.current;
    if (!drag) {
      return;
    }

    document.removeEventListener('pointermove', handleSplitPaneDragPointerMove, true);
    document.removeEventListener('pointerup', handleSplitPaneDragPointerUp, true);
    document.removeEventListener('pointercancel', handleSplitPaneDragPointerCancel, true);
    document.body.style.cursor = drag.previousBodyCursor;
    document.body.style.userSelect = drag.previousBodyUserSelect;
    activeSplitPaneDragRef.current = null;
    setSplitDropTarget(null);
    setLayoutPanelDragging(false);
    requestNativeCaretOverlayRefresh();

    if (!commit || !event || !drag.hasMoved) {
      return;
    }

    const target = resolveSplitDropTarget({
      path: '',
      sourceLeafId: drag.sourceLeafId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (!target || target.leafId === drag.sourceLeafId) {
      return;
    }

    setSplitPaneTree((currentTree) => moveNotesSplitPaneLeaf(
      currentTree,
      drag.sourceLeafId,
      target.leafId,
      target.direction,
      nextSplitPaneId('split'),
    ));
  }, [
    handleSplitPaneDragPointerMove,
    handleSplitPaneDragPointerCancel,
    handleSplitPaneDragPointerUp,
    nextSplitPaneId,
    resolveSplitDropTarget,
    setLayoutPanelDragging,
  ]);
  stopSplitPaneDragRef.current = stopSplitPaneDrag;

  const beginSplitPaneDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    sourceLeafId: string,
  ) => {
    if (!active || !hasSplitPanes) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (activeSplitResizeRef.current) {
      stopSplitResize();
    }
    if (activeSplitPaneDragRef.current) {
      stopSplitPaneDrag();
    }

    activeSplitPaneDragRef.current = {
      hasMoved: false,
      initialClientX: event.clientX,
      initialClientY: event.clientY,
      previousBodyCursor: document.body.style.cursor,
      previousBodyUserSelect: document.body.style.userSelect,
      sourceLeafId,
    };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    setLayoutPanelDragging(true);
    document.addEventListener('pointermove', handleSplitPaneDragPointerMove, true);
    document.addEventListener('pointerup', handleSplitPaneDragPointerUp, true);
    document.addEventListener('pointercancel', handleSplitPaneDragPointerCancel, true);
  }, [
    active,
    handleSplitPaneDragPointerCancel,
    handleSplitPaneDragPointerMove,
    handleSplitPaneDragPointerUp,
    hasSplitPanes,
    setLayoutPanelDragging,
    stopSplitPaneDrag,
    stopSplitResize,
  ]);

  useEffect(() => {
    return () => {
      stopSplitPaneDrag();
    };
  }, [stopSplitPaneDrag]);

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
    applyPendingSplitEditorFocus();
    onPrimaryContentReady?.();
  }, [applyPendingSplitEditorFocus, currentNotePath, onPrimaryContentReady]);

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

  const currentSplitPaneTitle = currentNotePath ? getDisplayName(currentNotePath) : '';
  const primaryEditorContent = (
    <div
      className="relative h-full min-h-0 min-w-0"
      data-notes-split-pane-content="primary"
    >
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
            compactHeader={hasSplitPanes}
            hideNoteActions={hasSplitPanes}
          />
        </Suspense>
      ) : null}
    </div>
  );
  const renderPrimaryEditorPane = (sourceLeafId?: string) => (
    hasSplitPanes ? (
      <section
        className="relative flex h-full min-h-0 min-w-0 flex-col bg-[var(--vlaina-bg-primary)]"
        data-notes-split-pane="primary"
      >
        <NotesSplitPaneChrome
          path={currentNotePath ?? undefined}
          sourceLeafId={sourceLeafId}
          title={currentSplitPaneTitle}
          onDragPointerDown={beginSplitPaneDrag}
          actions={(
            <NoteToolbarActions
              currentNotePath={currentNotePath}
              currentNoteTitle={currentSplitPaneTitle}
              getCurrentNoteContent={() => currentNoteContent}
              notesPath={notesPath}
              starred={currentNoteStarred}
              toggleStarred={toggleStarred}
              currentNoteMetadata={currentNoteMetadata}
              buttonClassName="h-7 w-7"
              forceShowChat
            />
          )}
          onClose={closeActiveSplitPane}
        />
        <div className="min-h-0 flex-1">
          {primaryEditorContent}
        </div>
      </section>
    ) : (
      <div
        className="relative h-full min-h-0 min-w-0"
        data-notes-split-pane="primary"
      >
        {primaryEditorContent}
      </div>
    )
  );

  const getSplitPaneContent = (path: string) => (
    currentNotePath === path
      ? currentNoteContent
      : noteContentsCache.get(path)?.content ?? ''
  );

  const renderLeafDropOverlay = (leafId: string) => (
    splitDropTarget?.leafId === leafId ? (
      <NotesSplitDropOverlay direction={splitDropTarget.direction} />
    ) : null
  );

  function renderSplitPaneTree(node: NotesSplitPaneTree) {
    if (node.type === 'primary') {
      const displacedPrimaryLeaf = activeSplitPreviewLeafId && primaryPreviewLeaf
        ? primaryPreviewLeaf
        : null;
      const leafPath = displacedPrimaryLeaf?.path ?? currentNotePath;

      return (
        <div
          key={node.id}
          className="relative h-full min-h-0 min-w-0"
          data-notes-split-leaf-id={node.id}
          data-notes-split-leaf-path={leafPath ?? undefined}
          data-notes-split-pane={displacedPrimaryLeaf ? 'preview' : undefined}
        >
          {displacedPrimaryLeaf ? (
            <NotesSplitPreviewPane
              content={getSplitPaneContent(displacedPrimaryLeaf.path)}
              path={displacedPrimaryLeaf.path}
              sourceLeafId={node.id}
              title={getDisplayName(displacedPrimaryLeaf.path)}
              onActivate={(point) => activatePrimaryPreviewPane(displacedPrimaryLeaf.path, point)}
              onPaneDragPointerDown={beginSplitPaneDrag}
              onClose={closePrimaryPreviewPane}
            />
          ) : renderPrimaryEditorPane(node.id)}
          {renderLeafDropOverlay(node.id)}
        </div>
      );
    }

    if (node.type === 'preview') {
      const isActivePreviewLeaf = activeSplitPreviewLeafId === node.id && currentNotePath === node.path;
      const content = getSplitPaneContent(node.path);

      return (
        <div
          key={node.id}
          className="relative h-full min-h-0 min-w-0"
          data-notes-split-leaf-id={node.id}
          data-notes-split-leaf-path={node.path}
          data-notes-split-pane={isActivePreviewLeaf ? 'primary' : 'preview'}
        >
          {isActivePreviewLeaf ? (
            renderPrimaryEditorPane(node.id)
          ) : (
            <NotesSplitPreviewPane
              content={content}
              path={node.path}
              sourceLeafId={node.id}
              title={getDisplayName(node.path)}
              onActivate={(point) => activateSplitPane(node.id, node.path, point)}
              onPaneDragPointerDown={beginSplitPaneDrag}
              onClose={() => closeSplitPane(node.id)}
            />
          )}
          {renderLeafDropOverlay(node.id)}
        </div>
      );
    }

    const isHorizontal = node.orientation === 'horizontal';
    const divider = (
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        data-notes-split-divider={node.orientation}
        data-notes-split-id={node.id}
        className={cn(
          'group relative z-[var(--vlaina-z-10)] touch-none bg-transparent',
          isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize'
        )}
        onPointerDown={(event) => beginSplitResize(node.id, node.orientation, event)}
      >
        <div
          className={cn(
            'absolute bg-[var(--vlaina-accent)]',
            isHorizontal
              ? 'bottom-0 left-1/2 top-0 w-[var(--vlaina-size-2px)] -translate-x-1/2'
              : 'left-0 right-0 top-1/2 h-[var(--vlaina-size-2px)] -translate-y-1/2'
          )}
        />
      </div>
    );

    return (
      <div
        key={node.id}
        className="grid h-full min-h-0 w-full min-w-0"
        data-notes-split-layout={node.direction}
        data-notes-split-orientation={node.orientation}
        style={isHorizontal
          ? {
              gridTemplateColumns: `minmax(0, ${node.ratio}fr) var(--vlaina-size-4px) minmax(0, ${1 - node.ratio}fr)`,
            }
          : {
              gridTemplateRows: `minmax(0, ${node.ratio}fr) var(--vlaina-size-4px) minmax(0, ${1 - node.ratio}fr)`,
            }}
      >
        <div className="min-h-0 min-w-0">{renderSplitPaneTree(node.first)}</div>
        {divider}
        <div className="min-h-0 min-w-0">{renderSplitPaneTree(node.second)}</div>
      </div>
    );
  }

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
        <div
          ref={splitDropRootRef}
          className="flex-1 min-w-0 relative"
          data-notes-split-drop-root="true"
        >
          {renderSplitPaneTree(splitPaneTree)}
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

        {active && hasSplitPanes ? <NotesSplitDiagnosticsButton /> : null}
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
