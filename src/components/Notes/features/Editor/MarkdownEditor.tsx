import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { selectMarkdownBodyLineNumbersEnabled } from '@/stores/unified/settings/markdownSettings';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { NoteHeader } from './NoteHeader';
import { useNoteCoverController, NoteCoverCanvas } from '../Cover';
import { DEFAULT_HEIGHT as DEFAULT_COVER_HEIGHT } from '../Cover/utils/coverConstants';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { useEditorLayout } from './hooks/useEditorLayout';
import { createScrollRestoreSession } from './utils/scrollRestoreSession';
import {
  subscribeCurrentEditorBlockPositionSnapshot,
} from './utils/editorBlockPositionCache';
import { getCurrentEditorView } from './utils/editorViewRegistry';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { useNoteEditorFind } from './find/useNoteEditorFind';
import type { EditorTopRightToolbarProps } from './EditorTopRightToolbar';
import {
  loadPersistedNoteScrollPosition,
  persistNoteScrollPosition,
} from './utils/noteScrollPositionStorage';
import {
  flushCurrentPendingEditorMarkdown,
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import { findStarredEntryByPath } from '@/stores/notes/starred';
import { NOTE_SOURCE_MODE_TOGGLE_EVENT } from './sourceMode/sourceModeEvents';
import {
  getSidebarSearchNavigationPendingPath,
  isSidebarSearchNavigationPending,
  subscribeSidebarSearchNavigationPending,
} from '../Sidebar/sidebarSearchNavigation';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import {
  canKeepCoverDuringEditorReload,
  getStableCoverSignature,
  type RenderedCoverSnapshot,
} from './utils/coverRenderStability';
import { themeEditorLayoutTokens, themeRenderingTokens } from '@/styles/themeTokens';
import 'katex/dist/katex.min.css';
import './styles/index.css';

const MERMAID_PREWARM_DELAY_MS = import.meta.env.DEV
  ? themeEditorLayoutTokens.mermaidPrewarmDelayMsDev
  : themeEditorLayoutTokens.mermaidPrewarmDelayMsProd;

export function canPersistNoteScrollPosition(scrollRoot: HTMLElement | null): scrollRoot is HTMLElement {
  return Boolean(
    scrollRoot
    && scrollRoot.isConnected
    && scrollRoot.clientHeight > 0
    && scrollRoot.scrollHeight > 0
  );
}

const EditorTopRightToolbar = lazy(async () => {
  const mod = await import('./EditorTopRightToolbar');
  return {
    default: (props: EditorTopRightToolbarProps) => (
      <mod.EditorTopRightToolbar {...props} />
    ),
  };
});

const MilkdownEditorRuntime = lazy(async () => {
  const mod = await import('./MilkdownEditorInner');
  return { default: mod.MilkdownEditorRuntime };
});

export function MarkdownEditor({
  active = true,
  isPeeking = false,
  peekOffset = 0,
  onEditorViewReady,
}: {
  active?: boolean;
  isPeeking?: boolean;
  peekOffset?: number;
  onEditorViewReady?: () => void;
}) {
  const { contentOffset } = useEditorLayout(isPeeking, peekOffset);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const scrollPositionSaveFrameRef = useRef<number | null>(null);
  const pendingScrollPositionSaveRef = useRef<{ path: string; scrollTop: number } | null>(null);
  const scrollPositionPersistTimerRef = useRef<number | null>(null);
  const pendingPersistentScrollPositionRef = useRef<{
    notesPath: string | null;
    path: string;
    scrollTop: number;
  } | null>(null);
  const activePathRef = useRef<string | null>(null);
  const activeNotesPathRef = useRef<string | null>(null);
  const restoreSessionRef = useRef<{ path: string; targetScrollTop: number } | null>(null);
  const lastRenderedCoverRef = useRef<RenderedCoverSnapshot | null>(null);
  const [editorReadyTarget, setEditorReadyTarget] = useState<{
    path: string | undefined;
  } | null>(null);
  const [editorInitTimedOutPath, setEditorInitTimedOutPath] = useState<string | null>(null);
  const [isSourceMode, setIsSourceMode] = useState(false);

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteRevision = useNotesStore(s => s.currentNoteRevision);
  const workspaceRestoredNote = useNotesStore(s => s.workspaceRestoredNote);
  const showBodyLineNumbers = useUnifiedStore(selectMarkdownBodyLineNumbersEnabled);
  const saveNote = useNotesStore(s => s.saveNote);
  const notesPath = useNotesStore(s => s.notesPath);
  const currentNoteTitle = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath) return '';
      return state.getDisplayName(currentNotePath);
    }, [currentNotePath])
  );
  const openTabs = useNotesStore(s => s.openTabs);
  const starred = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath) return false;
      return Boolean(findStarredEntryByPath(state.starredEntries, 'note', currentNotePath, state.notesPath));
    }, [currentNotePath])
  );
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const currentNoteCreatedAt = useNotesStore(
    useCallback((state) => {
      return getNoteMetadataEntry(state.noteMetadata, currentNotePath)?.createdAt;
    }, [currentNotePath])
  );
  const currentNoteUpdatedAt = useNotesStore(
    useCallback((state) => {
      return getNoteMetadataEntry(state.noteMetadata, currentNotePath)?.updatedAt;
    }, [currentNotePath])
  );

  const currentNoteMetadata = useMemo(() => {
    if (currentNoteCreatedAt === undefined && currentNoteUpdatedAt === undefined) {
      return undefined;
    }

    return {
      createdAt: currentNoteCreatedAt,
      updatedAt: currentNoteUpdatedAt,
    };
  }, [currentNoteCreatedAt, currentNoteUpdatedAt]);
  const openTabPathsKey = useMemo(
    () => openTabs.map((tab) => tab.path).join('\0'),
    [openTabs],
  );
  const pendingSidebarSearchNavigationPath = useSyncExternalStore(
    subscribeSidebarSearchNavigationPending,
    getSidebarSearchNavigationPendingPath,
    getSidebarSearchNavigationPendingPath,
  );
  const isSidebarSearchJumpPending =
    Boolean(currentNotePath && pendingSidebarSearchNavigationPath === currentNotePath);
  const shouldPreserveStartupEditorPosition =
    Boolean(
      currentNotePath &&
      workspaceRestoredNote?.path === currentNotePath &&
      workspaceRestoredNote.revision === currentNoteRevision
    );

  const coverController = useNoteCoverController(currentNotePath);
  const coverUrl = coverController.cover.url;
  const coverSignature = useMemo(
    () => getStableCoverSignature(coverController.cover),
    [coverController.cover]
  );
  const editorFind = useNoteEditorFind(currentNotePath);
  useHeldPageScroll(scrollRootRef, { enabled: active });
  const hasRenderableNote = Boolean(currentNotePath);
  const hasActiveNote = active && hasRenderableNote;
  const isEditorViewReady = editorReadyTarget?.path === currentNotePath;
  const shouldRenderCover = hasActiveNote && (
    isEditorViewReady ||
    canKeepCoverDuringEditorReload({
      hasActiveNote,
      isEditorViewReady,
      coverUrl,
      currentNotePath,
      coverSignature,
      lastRenderedCover: lastRenderedCoverRef.current,
    })
  );
  const shouldReserveCoverSpace = hasActiveNote && Boolean(coverUrl) && !shouldRenderCover;
  const reservedCoverHeight = coverController.cover.height ?? DEFAULT_COVER_HEIGHT;
  const coverLayoutActive = Boolean(coverUrl) || coverController.isPickerOpen;
  const handleEditorViewReady = useCallback(() => {
    setEditorInitTimedOutPath(null);
    setEditorReadyTarget({
      path: currentNotePath,
    });
    onEditorViewReady?.();
  }, [currentNotePath, onEditorViewReady]);
  const shouldUseSourceFallback =
    !isSourceMode && hasActiveNote && currentNotePath !== undefined && editorInitTimedOutPath === currentNotePath;
  const getCurrentNoteContent = useCallback(() => {
    if (!currentNotePath) {
      return '';
    }

    const state = useNotesStore.getState();
    const currentNote = state.currentNote;
    if (currentNote?.path === currentNotePath) {
      return currentNote.content;
    }

    return state.noteContentsCache.get(currentNotePath)?.content ?? '';
  }, [currentNotePath]);

  const handleToggleSourceMode = useCallback(() => {
    flushCurrentPendingEditorMarkdown();
    setIsSourceMode((nextSourceMode) => !nextSourceMode);
  }, []);

  useEffect(() => {
    if (!hasActiveNote) {
      return;
    }

    window.addEventListener(NOTE_SOURCE_MODE_TOGGLE_EVENT, handleToggleSourceMode);
    return () => {
      window.removeEventListener(NOTE_SOURCE_MODE_TOGGLE_EVENT, handleToggleSourceMode);
    };
  }, [handleToggleSourceMode, hasActiveNote]);

  const flushPendingPersistedScrollPosition = useCallback(() => {
    if (scrollPositionPersistTimerRef.current !== null) {
      window.clearTimeout(scrollPositionPersistTimerRef.current);
      scrollPositionPersistTimerRef.current = null;
    }

    const pending = pendingPersistentScrollPositionRef.current;
    pendingPersistentScrollPositionRef.current = null;
    if (!pending) {
      return;
    }

    persistNoteScrollPosition(pending.notesPath, pending.path, pending.scrollTop);
  }, []);

  const schedulePersistedScrollPosition = useCallback((
    notesRootPath: string | null,
    path: string,
    scrollTop: number,
  ) => {
    pendingPersistentScrollPositionRef.current = {
      notesPath: notesRootPath,
      path,
      scrollTop,
    };

    if (scrollPositionPersistTimerRef.current !== null) {
      window.clearTimeout(scrollPositionPersistTimerRef.current);
    }

    scrollPositionPersistTimerRef.current = window.setTimeout(() => {
      flushPendingPersistedScrollPosition();
    }, 500);
  }, [flushPendingPersistedScrollPosition]);

  useEffect(() => {
    setEditorInitTimedOutPath(null);
    if (isSourceMode || !hasActiveNote || !currentNotePath || isEditorViewReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const hasLiveEditor =
        Boolean(getCurrentEditorView()) ||
        Boolean(scrollRootRef.current?.querySelector('.milkdown .ProseMirror'));
      if (hasLiveEditor) {
        setEditorReadyTarget({
          path: currentNotePath,
        });
        onEditorViewReady?.();
        return;
      }

      setEditorInitTimedOutPath(currentNotePath);
      onEditorViewReady?.();
    }, themeEditorLayoutTokens.editorInitFallbackDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentNotePath, hasActiveNote, isEditorViewReady, isSourceMode, onEditorViewReady]);

  useEffect(() => {
    if (isSourceMode && hasActiveNote) {
      handleEditorViewReady();
    }
  }, [handleEditorViewReady, hasActiveNote, isSourceMode]);

  useEffect(() => {
    if (!hasActiveNote) {
      return;
    }

    let idleId: number | null = null;
    const timeoutId = window.setTimeout(() => {
      const preload = () => {
        void import('./plugins/mermaid/mermaidRenderer').then((mod) => {
          mod.prewarmMermaidRenderer();
        }).catch(() => undefined);
      };

      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(preload, { timeout: themeEditorLayoutTokens.mermaidIdlePrewarmTimeoutMs });
        return;
      }

      preload();
    }, MERMAID_PREWARM_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null) {
        window.cancelIdleCallback?.(idleId);
      }
    };
  }, [hasActiveNote]);

  useEffect(() => {
    if (shouldRenderCover && coverSignature) {
      lastRenderedCoverRef.current = {
        notePath: currentNotePath,
        coverSignature,
      };
      return;
    }

    if (!hasActiveNote || !coverSignature) {
      lastRenderedCoverRef.current = null;
    }
  }, [coverSignature, currentNotePath, hasActiveNote, shouldRenderCover]);

  const handleEditorClick = (e: React.MouseEvent) => {
    if (!hasActiveNote) {
      return;
    }

    if (e.target === e.currentTarget) {
      const editor = document.querySelector(
        isSourceMode
          ? '[data-note-source-editor="true"]'
          : '.milkdown .ProseMirror'
      ) as HTMLElement;
      editor?.focus();
    }
  };

  useEffect(() => {
    if (!active) {
      return;
    }

    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const commitPendingScrollPosition = () => {
      scrollPositionSaveFrameRef.current = null;
      const pending = pendingScrollPositionSaveRef.current;
      pendingScrollPositionSaveRef.current = null;
      if (!pending) {
        return;
      }
      scrollPositionsRef.current.set(pending.path, pending.scrollTop);
      if (canPersistNoteScrollPosition(scrollRoot)) {
        schedulePersistedScrollPosition(activeNotesPathRef.current, pending.path, pending.scrollTop);
      }
    };

    const handleScroll = () => {
      const path = activePathRef.current;
      if (!path) return;

      const restoreSession = restoreSessionRef.current;
      if (restoreSession?.path === path) return;

      pendingScrollPositionSaveRef.current = {
        path,
        scrollTop: scrollRoot.scrollTop,
      };
      if (scrollPositionSaveFrameRef.current !== null) {
        return;
      }

      scrollPositionSaveFrameRef.current = requestAnimationFrame(commitPendingScrollPosition);
    };

    scrollRoot.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollRoot.removeEventListener('scroll', handleScroll);
      if (scrollPositionSaveFrameRef.current !== null) {
        cancelAnimationFrame(scrollPositionSaveFrameRef.current);
        commitPendingScrollPosition();
      }
      flushPendingPersistedScrollPosition();
    };
  }, [active, flushPendingPersistedScrollPosition, schedulePersistedScrollPosition]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const flushCurrentScrollPosition = () => {
      const path = activePathRef.current;
      const scrollRoot = scrollRootRef.current;
      if (!path || !canPersistNoteScrollPosition(scrollRoot)) {
        return;
      }

      scrollPositionsRef.current.set(path, scrollRoot.scrollTop);
      flushPendingPersistedScrollPosition();
      persistNoteScrollPosition(activeNotesPathRef.current, path, scrollRoot.scrollTop);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushCurrentScrollPosition();
      }
    };

    window.addEventListener('beforeunload', flushCurrentScrollPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', flushCurrentScrollPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushCurrentScrollPosition();
    };
  }, [active, flushPendingPersistedScrollPosition]);

  useEffect(() => {
    const openTabPaths = new Set(openTabPathsKey ? openTabPathsKey.split('\0') : []);
    for (const path of scrollPositionsRef.current.keys()) {
      if (!openTabPaths.has(path)) {
        scrollPositionsRef.current.delete(path);
      }
    }
  }, [openTabPathsKey]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    if (!active) {
      const path = activePathRef.current;
      if (path && canPersistNoteScrollPosition(scrollRoot)) {
        scrollPositionsRef.current.set(path, scrollRoot.scrollTop);
        flushPendingPersistedScrollPosition();
        persistNoteScrollPosition(activeNotesPathRef.current, path, scrollRoot.scrollTop);
      }
      restoreSessionRef.current = null;
      return;
    }

    const previousPath = activePathRef.current;

    if (previousPath) {
      const cachedScrollTop = scrollPositionsRef.current.get(previousPath);
      const nextSavedScrollTop = cachedScrollTop ?? scrollRoot.scrollTop;
      scrollPositionsRef.current.set(previousPath, nextSavedScrollTop);
      if (canPersistNoteScrollPosition(scrollRoot)) {
        flushPendingPersistedScrollPosition();
        persistNoteScrollPosition(activeNotesPathRef.current, previousPath, nextSavedScrollTop);
      }
    }

    activePathRef.current = currentNotePath ?? null;
    activeNotesPathRef.current = currentNotePath ? notesPath : null;

    if (!hasActiveNote || !currentNotePath) {
      restoreSessionRef.current = null;
      activeNotesPathRef.current = null;
      scrollRoot.scrollTop = 0;
      return;
    }

    if (isSidebarSearchNavigationPending(currentNotePath)) {
      restoreSessionRef.current = null;
      return;
    }

    const targetScrollTop =
      scrollPositionsRef.current.get(currentNotePath)
      ?? loadPersistedNoteScrollPosition(notesPath, currentNotePath)
      ?? 0;
    restoreSessionRef.current = {
      path: currentNotePath,
      targetScrollTop,
    };

    let unsubscribeBlockSnapshot = () => {};
    let frameA = 0;
    let timeoutId = 0;

    const restoreSession = createScrollRestoreSession({
      notePath: currentNotePath,
      targetScrollTop,
      getActivePath: () => activePathRef.current,
      getSessionPath: () => restoreSessionRef.current?.path ?? null,
      readScrollTop: () => scrollRoot.scrollTop,
      writeScrollTop: (nextScrollTop) => {
        scrollRoot.scrollTop = nextScrollTop;
      },
      onApply: () => {},
      onFinish: () => {
        scrollPositionsRef.current.set(currentNotePath, scrollRoot.scrollTop);
        if (canPersistNoteScrollPosition(scrollRoot)) {
          flushPendingPersistedScrollPosition();
          persistNoteScrollPosition(notesPath, currentNotePath, scrollRoot.scrollTop);
        }
        restoreSessionRef.current = null;
      },
      onStop: () => {
        unsubscribeBlockSnapshot();
        cancelAnimationFrame(frameA);
        window.clearTimeout(timeoutId);
      },
    });

    restoreSession.restore('sync');
    unsubscribeBlockSnapshot = subscribeCurrentEditorBlockPositionSnapshot((snapshot) => {
      if (
        !restoreSession.isActive()
        || !snapshot
        || snapshot.scrollRoot !== scrollRoot
        || activePathRef.current !== currentNotePath
      ) {
        return;
      }

      const alreadyRestored = restoreSession.restore(`snapshot:${snapshot.version}`, snapshot.scrollTop);
      if (alreadyRestored) {
        restoreSession.finish();
      }
    });
    frameA = requestAnimationFrame(() => {
      const alreadyRestored = restoreSession.restore('raf');
      if (alreadyRestored) {
        restoreSession.finish();
      }
    });
    timeoutId = window.setTimeout(() => {
      restoreSession.restore('timeout');
      restoreSession.finish();
    }, themeEditorLayoutTokens.scrollRestoreTimeoutFallbackDelayMs);

    return () => {
      restoreSession.stop();
      if (restoreSessionRef.current?.path === currentNotePath) {
        restoreSessionRef.current = null;
      }
    };
  }, [active, currentNotePath, flushPendingPersistedScrollPosition, hasActiveNote, notesPath]);

  return (
    <div
      className="h-full flex flex-col relative"
      data-note-toolbar-root="true"
      onClick={handleEditorClick}
    >
      {hasActiveNote ? (
        <Suspense fallback={null}>
          <EditorTopRightToolbar
            editorFind={editorFind}
            currentNotePath={currentNotePath}
            currentNoteTitle={currentNoteTitle}
            getCurrentNoteContent={getCurrentNoteContent}
            isSourceMode={isSourceMode}
            onToggleSourceMode={handleToggleSourceMode}
            notesPath={notesPath}
            starred={starred}
            toggleStarred={toggleStarred}
            currentNoteMetadata={currentNoteMetadata}
          />
        </Suspense>
      ) : null}

      <OverlayScrollArea
        ref={scrollRootRef}
        className={cn(
          'flex-1 relative transition-opacity duration-[var(--vlaina-duration-75)]',
          isSidebarSearchJumpPending && 'opacity-[var(--vlaina-opacity-0)] pointer-events-none',
        )}
        viewportClassName="flex flex-col items-center relative"
        draggingBodyClassName="app-overlay-scrollbar-dragging"
        scrollbarVariant="compact"
        data-note-scroll-root="true"
      >
        {shouldRenderCover ? (
          <NoteCoverCanvas
            controller={coverController}
            notePath={currentNotePath}
          />
        ) : shouldReserveCoverSpace ? (
          <div
            aria-hidden="true"
            className="relative w-full shrink-0"
            data-note-cover-placeholder="true"
            style={{ height: reservedCoverHeight, overflowAnchor: themeRenderingTokens.overflowAnchorNone }}
          />
        ) : null}

        <div
          className="w-full flex flex-col items-center relative"
          style={{
            marginLeft: contentOffset,
            transition: themeEditorLayoutTokens.contentOffsetTransition,
          }}
        >
          {hasRenderableNote ? (
            <>
              <NoteHeader
                key={currentNotePath}
                coverUrl={coverUrl}
                coverLayoutActive={coverLayoutActive}
                onAddCover={coverController.openCoverPicker}
              />

              <Suspense fallback={null}>
                {isSourceMode ? (
                  <MarkdownSourceEditor
                    currentNotePath={currentNotePath ?? ''}
                    showBodyLineNumbers={showBodyLineNumbers}
                    saveNote={saveNote}
                    mode="source"
                  />
                ) : shouldUseSourceFallback ? (
                  <MarkdownSourceEditor
                    currentNotePath={currentNotePath}
                    showBodyLineNumbers={showBodyLineNumbers}
                    saveNote={saveNote}
                    mode="fallback"
                  />
                ) : (
                  <ErrorBoundary
                    key={currentNotePath ?? 'empty'}
                    fallback={(
                      <MarkdownSourceEditor
                        currentNotePath={currentNotePath ?? ''}
                        showBodyLineNumbers={showBodyLineNumbers}
                        saveNote={saveNote}
                        mode="fallback"
                      />
                    )}
                  >
                    <MilkdownEditorRuntime
                      active={active}
                      showBodyLineNumbers={showBodyLineNumbers}
                      preserveStartupEditorPosition={shouldPreserveStartupEditorPosition}
                      onEditorViewReady={handleEditorViewReady}
                    />
                  </ErrorBoundary>
                )}
              </Suspense>
            </>
          ) : null}

          {!hasRenderableNote ? (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px overflow-hidden opacity-0 pointer-events-none"
              data-note-editor-prewarm="true"
            >
              <Suspense fallback={null}>
                <MilkdownEditorRuntime
                  active={false}
                  showBodyLineNumbers={false}
                  preserveStartupEditorPosition={false}
                />
              </Suspense>
            </div>
          ) : null}

          {!hasRenderableNote ? (
            <div
              className={cn(
                'milkdown-editor min-h-[var(--vlaina-size-420px)]',
                showBodyLineNumbers && 'markdown-body-line-numbers',
                EDITOR_LAYOUT_CLASS
              )}
              data-note-placeholder-root="true"
            />
          ) : null}
        </div>
      </OverlayScrollArea>
    </div>
  );
}

function MarkdownSourceEditor({
  currentNotePath,
  showBodyLineNumbers,
  saveNote,
  mode,
}: {
  currentNotePath: string;
  showBodyLineNumbers: boolean;
  saveNote: (options?: { explicit?: boolean }) => Promise<void>;
  mode: 'source' | 'fallback';
}) {
  const { t } = useI18n();
  const updateContent = useNotesStore((state) => state.updateContent);
  const currentNoteContent = useNotesStore(
    useCallback((state) => (
      state.currentNote?.path === currentNotePath ? state.currentNote.content : ''
    ), [currentNotePath])
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef(currentNoteContent);
  const committedDraftRef = useRef(currentNoteContent);
  const lastFlushedSourceDraftRef = useRef<{ path: string; markdown: string }>({
    path: currentNotePath,
    markdown: currentNoteContent,
  });
  const isComposingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const textareaResizeFrameRef = useRef<number | null>(null);
  const contentCommitFrameRef = useRef<number | null>(null);

  const updateContentIfCurrentNoteIsActive = useCallback((markdown: string) => {
    if (useNotesStore.getState().currentNote?.path !== currentNotePath) {
      return;
    }
    updateContent(markdown);
  }, [currentNotePath, updateContent]);

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const resizeTextareaToContent = useCallback(() => {
    textareaResizeFrameRef.current = null;
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, textarea.clientHeight)}px`;
  }, []);

  const scheduleTextareaResize = useCallback(() => {
    if (textareaResizeFrameRef.current !== null) {
      return;
    }

    textareaResizeFrameRef.current = window.requestAnimationFrame(resizeTextareaToContent);
  }, [resizeTextareaToContent]);

  const flushScheduledContentCommit = useCallback(() => {
    if (contentCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(contentCommitFrameRef.current);
      contentCommitFrameRef.current = null;
    }

    updateContentIfCurrentNoteIsActive(committedDraftRef.current);
  }, [updateContentIfCurrentNoteIsActive]);

  const scheduleContentCommit = useCallback(() => {
    if (contentCommitFrameRef.current !== null) {
      return;
    }

    contentCommitFrameRef.current = window.requestAnimationFrame(() => {
      contentCommitFrameRef.current = null;
      updateContentIfCurrentNoteIsActive(committedDraftRef.current);
    });
  }, [updateContentIfCurrentNoteIsActive]);

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== currentNoteContent) {
      textareaRef.current.value = currentNoteContent;
    }
    draftRef.current = currentNoteContent;
    committedDraftRef.current = currentNoteContent;
    lastFlushedSourceDraftRef.current = {
      path: currentNotePath,
      markdown: currentNoteContent,
    };
    scheduleTextareaResize();
  }, [currentNoteContent, currentNotePath, scheduleTextareaResize]);

  useEffect(() => {
    return clearPendingSave;
  }, [clearPendingSave, currentNotePath]);

  useEffect(() => {
    scheduleTextareaResize();
    return () => {
      if (textareaResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(textareaResizeFrameRef.current);
        textareaResizeFrameRef.current = null;
      }
      if (contentCommitFrameRef.current !== null) {
        window.cancelAnimationFrame(contentCommitFrameRef.current);
        contentCommitFrameRef.current = null;
      }
    };
  }, [scheduleTextareaResize]);

  const flushSourceDraft = useCallback((options: { force?: boolean } = {}) => {
    if (isComposingRef.current && !options.force) {
      return false;
    }
    const markdown = isComposingRef.current ? committedDraftRef.current : draftRef.current;
    if (!isComposingRef.current) {
      committedDraftRef.current = markdown;
      flushScheduledContentCommit();
    }

    const lastFlushedDraft = lastFlushedSourceDraftRef.current;
    if (lastFlushedDraft.path === currentNotePath && lastFlushedDraft.markdown === markdown) {
      return true;
    }

    const didFlush = flushPendingEditorMarkdown(currentNotePath, markdown);
    if (didFlush || useNotesStore.getState().currentNote?.path === currentNotePath) {
      lastFlushedSourceDraftRef.current = {
        path: currentNotePath,
        markdown,
      };
      return true;
    }

    return false;
  }, [currentNotePath, flushScheduledContentCommit]);

  useEffect(() => {
    const unregisterPendingMarkdownFlusher = setPendingEditorMarkdownFlusher(flushSourceDraft);
    return () => {
      flushSourceDraft({ force: true });
      unregisterPendingMarkdownFlusher();
    };
  }, [flushSourceDraft]);

  useEffect(() => {
    return () => {
      flushSourceDraft({ force: true });
      clearPendingSave();
      if (mode === 'source') {
        void saveNote({ explicit: false }).catch(() => undefined);
      }
    };
  }, [clearPendingSave, flushSourceDraft, mode, saveNote]);

  const scheduleSave = useCallback(() => {
    clearPendingSave();
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveNote({ explicit: false }).catch(() => undefined);
    }, themeEditorLayoutTokens.autoSaveDebounceMs);
  }, [clearPendingSave, saveNote]);

  const flushSave = useCallback(() => {
    flushSourceDraft({ force: true });
    clearPendingSave();
    void saveNote({ explicit: false }).catch(() => undefined);
  }, [clearPendingSave, flushSourceDraft, saveNote]);

  return (
    <div
      className={cn(
        'milkdown-editor theme-vlaina is-live-preview max is-readable-line-width min-h-[var(--vlaina-height-editor-min)]',
        showBodyLineNumbers && 'markdown-body-line-numbers',
        EDITOR_LAYOUT_CLASS
      )}
      data-note-content-root="true"
      data-markdown-theme-root="true"
      data-markdown-theme-platform="vlaina"
      data-markdown-compat="native"
      data-markdown-compat-layer="native"
      data-note-source-editor-mode={mode}
      data-note-source-fallback={mode === 'fallback' ? 'true' : undefined}
      data-note-source-mode={mode === 'source' ? 'true' : undefined}
    >
      <textarea
        ref={textareaRef}
        data-note-source-editor="true"
        defaultValue={currentNoteContent}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          const nextValue = event.currentTarget.value;
          draftRef.current = nextValue;
          committedDraftRef.current = nextValue;
          if (mode === 'fallback') {
            updateContent(nextValue);
          } else {
            scheduleContentCommit();
          }
          scheduleTextareaResize();
          scheduleSave();
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          draftRef.current = nextValue;
          scheduleTextareaResize();
          if (isComposingRef.current || Boolean((event.nativeEvent as InputEvent).isComposing)) {
            return;
          }
          committedDraftRef.current = nextValue;
          if (mode === 'fallback') {
            updateContent(nextValue);
          } else {
            scheduleContentCommit();
          }
          scheduleSave();
        }}
        onBlur={flushSave}
        spellCheck={false}
        aria-label={t('editor.markdownSourceEditor')}
        className="block min-h-[var(--vlaina-height-prosemirror-min)] w-full resize-none overflow-hidden bg-transparent px-0 py-2 pb-[var(--vlaina-height-prosemirror-bottom-padding)] font-mono text-sm leading-6 text-[var(--vlaina-text-primary)] outline-none"
      />
    </div>
  );
}
