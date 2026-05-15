import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { NoteHeader } from './NoteHeader';
import { useNoteCoverController, NoteCoverCanvas } from '../Cover';
import { DEFAULT_HEIGHT as DEFAULT_COVER_HEIGHT } from '../Cover/utils/coverConstants';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { useEditorLayout } from './hooks/useEditorLayout';
import { useDeferredTextStats } from './hooks/useDeferredTextStats';
import { createScrollRestoreSession } from './utils/scrollRestoreSession';
import {
  subscribeCurrentEditorBlockPositionSnapshot,
} from './utils/editorBlockPositionCache';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { useNoteEditorFind } from './find';
import { EditorTopRightToolbar } from './EditorTopRightToolbar';
import {
  getSidebarSearchNavigationPendingPath,
  isSidebarSearchNavigationPending,
  subscribeSidebarSearchNavigationPending,
} from '../Sidebar/sidebarSearchNavigation';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import { MilkdownEditorInner } from './MilkdownEditorInner';
import { prewarmMermaidRenderer } from './plugins/mermaid/mermaidRenderer';
import './styles/index.css';

export function MarkdownEditor({
  active = true,
  isPeeking = false,
  peekOffset = 0,
}: {
  active?: boolean;
  isPeeking?: boolean;
  peekOffset?: number;
}) {
  const { contentOffset } = useEditorLayout(isPeeking, peekOffset);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const activePathRef = useRef<string | null>(null);
  const restoreSessionRef = useRef<{ path: string; targetScrollTop: number } | null>(null);
  const [editorReadyTarget, setEditorReadyTarget] = useState<{
    path: string | undefined;
    diskRevision: number;
  } | null>(null);

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const notesPath = useNotesStore(s => s.notesPath);
  const currentNoteTitle = useNotesStore(
    useCallback((state) => {
      if (!currentNotePath) return '';
      return state.getDisplayName(currentNotePath);
    }, [currentNotePath])
  );
  const currentNoteDiskRevision = useNotesStore(s => s.currentNoteDiskRevision);
  const openTabPathsKey = useNotesStore(s => s.openTabs.map((tab) => tab.path).join('\0'));
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return getNoteMetadataEntry(noteMetadata, currentNotePath);
  }, [currentNotePath, noteMetadata]);
  const textStats = useDeferredTextStats(currentNotePath, currentNoteContent);
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
  const editorFind = useNoteEditorFind(currentNotePath);
  useHeldPageScroll(scrollRootRef);
  const hasActiveNote = active && Boolean(currentNotePath);
  const isEditorViewReady =
    editorReadyTarget?.path === currentNotePath &&
    editorReadyTarget?.diskRevision === currentNoteDiskRevision;
  const shouldRenderCover = hasActiveNote && isEditorViewReady;
  const shouldReserveCoverSpace = hasActiveNote && Boolean(coverUrl) && !shouldRenderCover;
  const reservedCoverHeight = coverController.cover.height ?? DEFAULT_COVER_HEIGHT;
  const coverLayoutActive = Boolean(coverUrl) || coverController.isPickerOpen;
  const handleEditorViewReady = useCallback(() => {
    setEditorReadyTarget({
      path: currentNotePath,
      diskRevision: currentNoteDiskRevision,
    });
  }, [currentNoteDiskRevision, currentNotePath]);

  useEffect(() => {
    if (!hasActiveNote) {
      return;
    }

    const requestIdleCallback = window.requestIdleCallback;
    if (typeof requestIdleCallback === 'function') {
      const idleId = requestIdleCallback(() => prewarmMermaidRenderer(), { timeout: 1500 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(() => prewarmMermaidRenderer(), 250);
    return () => window.clearTimeout(timeoutId);
  }, [hasActiveNote]);

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
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const handleScroll = () => {
      const path = activePathRef.current;
      if (!path) return;

      const restoreSession = restoreSessionRef.current;
      if (restoreSession?.path === path) return;

      scrollPositionsRef.current.set(path, scrollRoot.scrollTop);
    };

    scrollRoot.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollRoot.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
    }, 160);

    return () => {
      restoreSession.stop();
      if (restoreSessionRef.current?.path === currentNotePath) {
        restoreSessionRef.current = null;
      }
    };
  }, [currentNotePath, hasActiveNote]);

  return (
    <div
      className="h-full flex flex-col bg-[var(--vlaina-bg-primary)] relative"
      data-note-toolbar-root="true"
      onClick={handleEditorClick}
    >
      {hasActiveNote ? (
        <EditorTopRightToolbar
          editorFind={editorFind}
          currentNotePath={currentNotePath}
          currentNoteContent={currentNoteContent}
          currentNoteTitle={currentNoteTitle}
          notesPath={notesPath}
          starred={starred}
          toggleStarred={toggleStarred}
          currentNoteMetadata={currentNoteMetadata}
          textStats={textStats}
        />
      ) : null}

      <OverlayScrollArea
        ref={scrollRootRef}
        className={cn(
          'flex-1 relative transition-opacity duration-75',
          isSidebarSearchJumpPending && 'opacity-0 pointer-events-none',
        )}
        viewportClassName="flex flex-col items-center relative"
        draggingBodyClassName="vlaina-overlay-scrollbar-dragging"
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
            style={{ height: reservedCoverHeight, overflowAnchor: 'none' }}
          />
        ) : null}

        <div
          className="w-full flex flex-col items-center"
          style={{
            marginLeft: contentOffset,
            transition: 'margin-left 180ms cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        >
          {hasActiveNote ? (
            <>
              <NoteHeader
                coverUrl={coverUrl}
                coverLayoutActive={coverLayoutActive}
                onAddCover={coverController.openCoverPicker}
              />

              <MilkdownProvider key={`${currentNotePath ?? 'empty'}:${currentNoteDiskRevision}`}>
                <MilkdownEditorInner onEditorViewReady={handleEditorViewReady} />
              </MilkdownProvider>
            </>
          ) : (
            <div
              className={cn('milkdown-editor min-h-[420px]', EDITOR_LAYOUT_CLASS)}
              data-note-placeholder-root="true"
            />
          )}
        </div>
      </OverlayScrollArea>
    </div>
  );
}
