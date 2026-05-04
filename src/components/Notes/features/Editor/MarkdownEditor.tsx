import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { tableBlock } from '@milkdown/kit/component/table-block';
import type { Parser } from '@milkdown/kit/transformer';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { NoteHeader } from './NoteHeader';
import { useNoteCoverController, NoteCoverCanvas } from '../Cover';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { configureTheme } from './theme';
import { customPlugins } from './config/plugins';
import { notesRemarkStringifyOptions } from './config/stringifyOptions';
import { useEditorLayout } from './hooks/useEditorLayout';
import { useEditorSave } from './hooks/useEditorSave';
import { calculateTextStats } from './utils/textStats';
import { createScrollRestoreSession } from './utils/scrollRestoreSession';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import {
  clearCurrentMarkdownRuntime,
  getCurrentEditorView,
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
import {
  clearCurrentEditorBlockPositionSnapshot,
  createCurrentEditorBlockPositionController,
  subscribeCurrentEditorBlockPositionSnapshot,
} from './utils/editorBlockPositionCache';
import {
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from './plugins/frontmatter/frontmatterMarkdown';
import { hasTemporaryTailParagraph } from './plugins/cursor/endBlankClickPlugin';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { useNoteEditorFind } from './find';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { EditorTopRightToolbar } from './EditorTopRightToolbar';
import {
  getSidebarSearchNavigationPendingPath,
  isSidebarSearchNavigationPending,
  subscribeSidebarSearchNavigationPending,
} from '../Sidebar/sidebarSearchNavigation';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import { logNotesDebug } from '@/stores/notes/debugLog';
import './styles/index.css';

const MilkdownEditorInner = React.memo(function MilkdownEditorInner() {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const notesPath = useNotesStore(s => s.notesPath);
  const isDraftNote = isDraftNotePath(currentNotePath);

  const hasAutoFocused = useRef(false);
  const hasScheduledAutoFocus = useRef(false);
  const hasIgnoredInitNoise = useRef(false);
  const lastEditorDebugRef = useRef<string | null>(null);
  const pendingMarkdownUpdateFrameRef = useRef<number | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);

  const initialContent = useMemo(() => {
    const content = useNotesStore.getState().currentNote?.content || '';
    return normalizeSerializedMarkdownDocument(content);
  }, [currentNotePath]);

  useEffect(() => {
    const snapshot = JSON.stringify({
      currentNotePath: currentNotePath ?? null,
      isDraftNote,
      notesPath,
      isNewlyCreated,
      initialContentLength: initialContent.length,
      initialContentTrimmedLength: initialContent.trim().length,
    });
    if (lastEditorDebugRef.current === snapshot) return;
    lastEditorDebugRef.current = snapshot;
    logNotesDebug('notes:editor:inner-state', JSON.parse(snapshot));
  }, [currentNotePath, initialContent, isDraftNote, isNewlyCreated, notesPath]);

  useEffect(() => {
    const handleBlur = () => {
      flushSave();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [flushSave]);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        const defaultValue = preserveMarkdownBlankLinesForEditor(
          normalizeLeadingFrontmatterMarkdown(initialContent)
        );

        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));

        const initTime = Date.now();
        const INIT_PERIOD = 500;

        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            const editorView = getCurrentEditorView();
            if (editorView && hasTemporaryTailParagraph(editorView.state)) {
              return;
            }

            const isInitializing = Date.now() - initTime < INIT_PERIOD;
            if (
              isInitializing &&
              !hasIgnoredInitNoise.current &&
              initialContent.trim().length > 0 &&
              markdown.trim().length < 5
            ) {
              hasIgnoredInitNoise.current = true;
              return;
            }

            const currentContent = useNotesStore.getState().currentNote?.content ?? '';
            const normalizedMarkdown = normalizeSerializedMarkdownDocument(markdown);
            const nextMarkdown = serializeLeadingFrontmatterMarkdown(normalizedMarkdown, currentContent);
            if (currentContent === nextMarkdown) {
              return;
            }

            pendingMarkdownRef.current = nextMarkdown;
            if (pendingMarkdownUpdateFrameRef.current !== null) {
              return;
            }

            pendingMarkdownUpdateFrameRef.current = requestAnimationFrame(() => {
              pendingMarkdownUpdateFrameRef.current = null;
              const pendingMarkdown = pendingMarkdownRef.current;
              pendingMarkdownRef.current = null;
              if (pendingMarkdown === null) {
                return;
              }

              const latestNote = useNotesStore.getState().currentNote;
              if (!latestNote || latestNote.path !== currentNotePath || latestNote.content === pendingMarkdown) {
                logNotesDebug('notes:editor:markdown-update-skipped', {
                  reason: !latestNote
                    ? 'missing-current-note'
                    : latestNote.path !== currentNotePath
                      ? 'stale-note-path'
                      : 'unchanged-content',
                  currentNotePath: currentNotePath ?? null,
                  latestNotePath: latestNote?.path ?? null,
                  pendingMarkdownLength: pendingMarkdown.length,
                });
                return;
              }
              logNotesDebug('notes:editor:markdown-update-committed', {
                currentNotePath,
                isDraftNote,
                notesPath,
                previousLength: latestNote.content.length,
                nextLength: pendingMarkdown.length,
                willDebouncedSave: !isDraftNote || Boolean(notesPath),
              });
              updateContent(pendingMarkdown);
              if (!isDraftNote || notesPath) {
                debouncedSave();
              }
            });
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(configureTheme)
      .use(tableBlock)
      .use(customPlugins),
    [currentNotePath, isDraftNote, notesPath]
  );

  useEffect(() => {
    hasAutoFocused.current = false;
    hasScheduledAutoFocus.current = false;
    hasIgnoredInitNoise.current = false;
    logNotesDebug('notes:editor:path-changed', {
      currentNotePath: currentNotePath ?? null,
      isDraftNote,
      isNewlyCreated,
      initialContentLength: initialContent.length,
    });
  }, [currentNotePath]);

  useEffect(() => {
    const flushPendingMarkdown = () => {
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        cancelAnimationFrame(pendingMarkdownUpdateFrameRef.current);
        pendingMarkdownUpdateFrameRef.current = null;
      }
      const pendingMarkdown = pendingMarkdownRef.current;
      pendingMarkdownRef.current = null;
      return flushPendingEditorMarkdown(currentNotePath, pendingMarkdown);
    };

    setPendingEditorMarkdownFlusher(flushPendingMarkdown);

    return () => {
      flushPendingMarkdown();
      setPendingEditorMarkdownFlusher(null);
    };
  }, [currentNotePath]);

  useEffect(() => {
    try {
      const editor = get?.();
      if (!editor) {
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
        return;
      }
      const view = editor.ctx.get(editorViewCtx);
      let parser: Parser | null = null;
      try {
        parser = editor.ctx.get(parserCtx);
      } catch {
        parser = null;
      }
      setCurrentEditorView(view as EditorView);
      const blockPositionController = createCurrentEditorBlockPositionController(view as EditorView);
      setCurrentMarkdownRuntime({ parser });
      return () => {
        blockPositionController.destroy();
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
      };
    } catch {
      setCurrentEditorView(null);
      clearCurrentEditorBlockPositionSnapshot();
      clearCurrentMarkdownRuntime();
      return;
    }
  }, [get, currentNotePath]);

  const isEmptyContent = useMemo(() => {
    const content = initialContent.trim();
    return content.length === 0 || /^#\s*$/.test(content);
  }, [initialContent]);

  const shouldFocusEmptyDraftBody = isDraftNote && !isNewlyCreated && isEmptyContent;

  const focusEditorBody = useCallback((source: string) => {
    try {
      const editor = get?.();
      if (!editor) {
        logNotesDebug('notes:editor:autofocus-failed', {
          source,
          reason: 'missing-editor',
          currentNotePath: currentNotePath ?? null,
        });
        return false;
      }

      const view = editor.ctx.get(editorViewCtx);
      if (!view) {
        logNotesDebug('notes:editor:autofocus-failed', {
          source,
          reason: 'missing-editor-view',
          currentNotePath: currentNotePath ?? null,
        });
        return false;
      }

      view.focus();
      logNotesDebug('notes:editor:autofocus-applied', {
        source,
        currentNotePath: currentNotePath ?? null,
        activeElementTag: document.activeElement?.tagName ?? null,
        activeElementClassName: document.activeElement instanceof HTMLElement
          ? document.activeElement.className
          : null,
      });
      return true;
    } catch (error) {
      logNotesDebug('notes:editor:autofocus-failed', {
        source,
        reason: 'exception',
        currentNotePath: currentNotePath ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }, [currentNotePath, get]);

  useEffect(() => {
    if (!get || hasAutoFocused.current || hasScheduledAutoFocus.current) return;
    const blockedReason = isNewlyCreated
      ? 'new-note-title-autofocus'
      : !isEmptyContent
        ? 'non-empty-content'
        : null;
    if (blockedReason) {
      logNotesDebug('notes:editor:autofocus-skipped', {
        reason: blockedReason,
        currentNotePath: currentNotePath ?? null,
        isDraftNote,
        isNewlyCreated,
        isEmptyContent,
      });
      return;
    }

    hasScheduledAutoFocus.current = true;
    logNotesDebug('notes:editor:autofocus-scheduled', {
      currentNotePath: currentNotePath ?? null,
      isDraftNote,
      isNewlyCreated,
      isEmptyContent,
    });

    const timer = setTimeout(() => {
      logNotesDebug('notes:editor:autofocus-timer-fired', {
        currentNotePath: currentNotePath ?? null,
        isDraftNote,
        isNewlyCreated,
        isEmptyContent,
      });
      const focused = focusEditorBody('timer');
      hasScheduledAutoFocus.current = false;
      if (focused) {
        hasAutoFocused.current = true;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      hasScheduledAutoFocus.current = false;
      logNotesDebug('notes:editor:autofocus-cleanup', {
        currentNotePath: currentNotePath ?? null,
        isDraftNote,
        isNewlyCreated,
        isEmptyContent,
      });
    };
  }, [currentNotePath, focusEditorBody, get, isDraftNote, isNewlyCreated, isEmptyContent]);

  useEffect(() => {
    if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
    const frame = requestAnimationFrame(() => {
      if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
      const focused = focusEditorBody('editor-ready-raf');
      if (focused) {
        hasAutoFocused.current = true;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      logNotesDebug('notes:editor:autofocus-ready-cleanup', {
        currentNotePath: currentNotePath ?? null,
        shouldFocusEmptyDraftBody,
      });
    };
  }, [currentNotePath, focusEditorBody, shouldFocusEmptyDraftBody]);

  return (
    <div
      className={cn("milkdown-editor", EDITOR_LAYOUT_CLASS)}
      data-note-content-root="true"
    >
      <Milkdown />
    </div>
  );
});

export function MarkdownEditor({
  isPeeking = false,
  peekOffset = 0,
}: {
  isPeeking?: boolean;
  peekOffset?: number;
}) {
  const { contentOffset } = useEditorLayout(isPeeking, peekOffset);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const activePathRef = useRef<string | null>(null);
  const restoreSessionRef = useRef<{ path: string; targetScrollTop: number } | null>(null);

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteDiskRevision = useNotesStore(s => s.currentNoteDiskRevision);
  const openTabPathsKey = useNotesStore(s => s.openTabs.map((tab) => tab.path).join('\0'));
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return getNoteMetadataEntry(noteMetadata, currentNotePath);
  }, [currentNotePath, noteMetadata]);
  const textStats = useMemo(() => calculateTextStats(currentNoteContent), [currentNoteContent]);
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

  const handleEditorClick = (e: React.MouseEvent) => {
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

    if (!currentNotePath) {
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
  }, [currentNotePath]);

  return (
    <div
      className="h-full flex flex-col bg-[var(--vlaina-bg-primary)] relative"
      data-note-toolbar-root="true"
      onClick={handleEditorClick}
    >
      <EditorTopRightToolbar
        editorFind={editorFind}
        currentNotePath={currentNotePath}
        starred={starred}
        toggleStarred={toggleStarred}
        currentNoteMetadata={currentNoteMetadata}
        textStats={textStats}
      />

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
        <NoteCoverCanvas
          controller={coverController}
          notePath={currentNotePath}
        />

        <div
          className="w-full flex flex-col items-center"
          style={{
            marginLeft: contentOffset,
            transition: 'margin-left 180ms cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        >
          <NoteHeader
            coverUrl={coverUrl}
            onAddCover={coverController.addRandomCoverAndOpenPicker}
          />

          <MilkdownProvider key={`${currentNotePath ?? 'empty'}:${currentNoteDiskRevision}`}>
            <MilkdownEditorInner />
          </MilkdownProvider>
        </div>
      </OverlayScrollArea>
    </div>
  );
}
