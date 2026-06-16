import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { selectMarkdownBodyLineNumbersEnabled } from '@/stores/unified/settings/markdownSettings';
import { cn } from '@/lib/utils';
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
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
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
  const activePathRef = useRef<string | null>(null);
  const restoreSessionRef = useRef<{ path: string; targetScrollTop: number } | null>(null);
  const lastRenderedCoverRef = useRef<RenderedCoverSnapshot | null>(null);
  const [editorReadyTarget, setEditorReadyTarget] = useState<{
    path: string | undefined;
  } | null>(null);
  const [editorInitTimedOutPath, setEditorInitTimedOutPath] = useState<string | null>(null);

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
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
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return getNoteMetadataEntry(noteMetadata, currentNotePath);
  }, [currentNotePath, noteMetadata]);
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

  const starred = currentNotePath ? isStarred(currentNotePath) : false;
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
    hasActiveNote && currentNotePath !== undefined && editorInitTimedOutPath === currentNotePath;
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

  useEffect(() => {
    setEditorInitTimedOutPath(null);
    if (!hasActiveNote || !currentNotePath || isEditorViewReady) {
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
  }, [currentNotePath, hasActiveNote, isEditorViewReady, onEditorViewReady]);

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
      const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
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
    };
  }, [active]);

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
      }
      restoreSessionRef.current = null;
      return;
    }

    const previousPath = activePathRef.current;

    if (previousPath) {
      const cachedScrollTop = scrollPositionsRef.current.get(previousPath);
      const nextSavedScrollTop = cachedScrollTop ?? scrollRoot.scrollTop;
      scrollPositionsRef.current.set(previousPath, nextSavedScrollTop);
    }

    activePathRef.current = currentNotePath ?? null;

    if (!hasActiveNote || !currentNotePath) {
      restoreSessionRef.current = null;
      scrollRoot.scrollTop = 0;
      return;
    }

    if (isSidebarSearchNavigationPending(currentNotePath)) {
      restoreSessionRef.current = null;
      return;
    }

    const targetScrollTop = scrollPositionsRef.current.get(currentNotePath) ?? 0;
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
  }, [active, currentNotePath, hasActiveNote]);

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
                {shouldUseSourceFallback ? (
                  <MarkdownSourceFallback
                    currentNotePath={currentNotePath}
                    showBodyLineNumbers={showBodyLineNumbers}
                    saveNote={saveNote}
                  />
                ) : (
                  <ErrorBoundary
                    key={currentNotePath ?? 'empty'}
                    fallback={(
                      <MarkdownSourceFallback
                        currentNotePath={currentNotePath ?? ''}
                        showBodyLineNumbers={showBodyLineNumbers}
                        saveNote={saveNote}
                      />
                    )}
                  >
                    <MilkdownEditorRuntime
                      active={active}
                      showBodyLineNumbers={showBodyLineNumbers}
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

function MarkdownSourceFallback({
  currentNotePath,
  showBodyLineNumbers,
  saveNote,
}: {
  currentNotePath: string;
  showBodyLineNumbers: boolean;
  saveNote: (options?: { explicit?: boolean }) => Promise<void>;
}) {
  const updateContent = useNotesStore((state) => state.updateContent);
  const currentNoteContent = useNotesStore(
    useCallback((state) => (
      state.currentNote?.path === currentNotePath ? state.currentNote.content : ''
    ), [currentNotePath])
  );
  const [draft, setDraft] = useState(currentNoteContent);
  const draftRef = useRef(currentNoteContent);
  const isComposingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setDraft(currentNoteContent);
    draftRef.current = currentNoteContent;
  }, [currentNoteContent, currentNotePath]);

  useEffect(() => {
    return clearPendingSave;
  }, [clearPendingSave, currentNotePath]);

  const flushFallbackDraft = useCallback((options: { force?: boolean } = {}) => {
    if (isComposingRef.current && !options.force) {
      return false;
    }
    return flushPendingEditorMarkdown(currentNotePath, draftRef.current);
  }, [currentNotePath]);

  useEffect(() => {
    const unregisterPendingMarkdownFlusher = setPendingEditorMarkdownFlusher(flushFallbackDraft);
    return () => {
      flushFallbackDraft({ force: true });
      unregisterPendingMarkdownFlusher();
    };
  }, [flushFallbackDraft]);

  useEffect(() => {
    return () => {
      clearPendingSave();
    };
  }, [clearPendingSave]);

  const scheduleSave = useCallback(() => {
    clearPendingSave();
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveNote({ explicit: false }).catch(() => undefined);
    }, themeEditorLayoutTokens.autoSaveDebounceMs);
  }, [clearPendingSave, saveNote]);

  const flushSave = useCallback(() => {
    clearPendingSave();
    void saveNote({ explicit: false }).catch(() => undefined);
  }, [clearPendingSave, saveNote]);

  return (
    <div
      className={cn(
        'milkdown-editor min-h-[var(--vlaina-size-420px)]',
        showBodyLineNumbers && 'markdown-body-line-numbers',
        EDITOR_LAYOUT_CLASS
      )}
      data-note-content-root="true"
      data-note-source-fallback="true"
    >
      <textarea
        value={draft}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          const nextValue = event.currentTarget.value;
          setDraft(nextValue);
          draftRef.current = nextValue;
          updateContent(nextValue);
          scheduleSave();
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          setDraft(nextValue);
          draftRef.current = nextValue;
          if (isComposingRef.current || Boolean((event.nativeEvent as InputEvent).isComposing)) {
            return;
          }
          updateContent(nextValue);
          scheduleSave();
        }}
        onBlur={flushSave}
        spellCheck={false}
        aria-label="Markdown source editor"
        className="min-h-[var(--vlaina-size-420px)] w-full resize-none bg-transparent px-0 py-2 font-mono text-sm leading-6 text-[var(--vlaina-text-primary)] outline-none"
      />
    </div>
  );
}
