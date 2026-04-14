import React, { useEffect, useRef, useMemo } from 'react';
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
import {
  clearCurrentMarkdownRuntime,
  getCurrentEditorView,
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
import {
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from './plugins/frontmatter/frontmatterMarkdown';
import { hasTemporaryTailParagraph } from './plugins/cursor/endBlankClickPlugin';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { useNoteEditorFind } from './find';
import { EditorTopRightToolbar } from './EditorTopRightToolbar';
import { isSidebarSearchNavigationPending } from '../Sidebar/sidebarSearchNavigation';
import {
  getSidebarSearchDebugScrollMeta,
  getSidebarSearchDebugViewMeta,
  logSidebarSearchDebug,
} from '../Sidebar/sidebarSearchDebug';
import './styles/index.css';

const MilkdownEditorInner = React.memo(function MilkdownEditorInner() {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);

  const hasAutoFocused = useRef(false);
  const hasIgnoredInitNoise = useRef(false);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);

  const initialContent = useMemo(() => {
    return useNotesStore.getState().currentNote?.content || '';
  }, [currentNotePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        flushSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flushSave]);

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
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, normalizeLeadingFrontmatterMarkdown(initialContent));
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

            const nextMarkdown = serializeLeadingFrontmatterMarkdown(markdown);
            const currentContent = useNotesStore.getState().currentNote?.content ?? '';
            if (currentContent === nextMarkdown) {
              return;
            }

            requestAnimationFrame(() => {
              const latestNote = useNotesStore.getState().currentNote;
              if (!latestNote || latestNote.path !== currentNotePath || latestNote.content === nextMarkdown) {
                return;
              }
              updateContent(nextMarkdown);
              debouncedSave();
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
    [currentNotePath]
  );

  useEffect(() => {
    hasAutoFocused.current = false;
    hasIgnoredInitNoise.current = false;
  }, [currentNotePath]);

  useEffect(() => {
    try {
      const editor = get?.();
      if (!editor) {
        setCurrentEditorView(null);
        clearCurrentMarkdownRuntime();
        logSidebarSearchDebug('editor:view-registry:clear:no-editor', {
          currentNotePath: currentNotePath ?? null,
        });
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
      setCurrentMarkdownRuntime({ parser });
      logSidebarSearchDebug('editor:view-registry:set', {
        currentNotePath: currentNotePath ?? null,
        view: getSidebarSearchDebugViewMeta(view as EditorView),
      });
      return () => {
        setCurrentEditorView(null);
        clearCurrentMarkdownRuntime();
        logSidebarSearchDebug('editor:view-registry:cleanup', {
          currentNotePath: currentNotePath ?? null,
          view: getSidebarSearchDebugViewMeta(view as EditorView),
        });
      };
    } catch {
      setCurrentEditorView(null);
      clearCurrentMarkdownRuntime();
      logSidebarSearchDebug('editor:view-registry:clear:error', {
        currentNotePath: currentNotePath ?? null,
      });
      return;
    }
  }, [get, currentNotePath]);

  const isEmptyContent = useMemo(() => {
    const content = initialContent.trim();
    return content.length === 0 || /^#\s*$/.test(content);
  }, [initialContent]);

  useEffect(() => {
    if (!get || hasAutoFocused.current) return;
    if (!isNewlyCreated && !isEmptyContent) return;

    hasAutoFocused.current = true;

    const timer = setTimeout(() => {
      try {
        const editor = get();
        if (!editor) return;

        const view = editor.ctx.get(editorViewCtx);
        if (!view) return;

        view.focus();
      } catch {
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [get, isNewlyCreated, isEmptyContent]);

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
  const currentNoteRevision = useNotesStore(s => s.currentNoteRevision);
  const openTabs = useNotesStore(s => s.openTabs);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return currentNotePath && noteMetadata?.notes ? noteMetadata.notes[currentNotePath] : undefined;
  }, [currentNotePath, noteMetadata]);
  const textStats = useMemo(() => calculateTextStats(currentNoteContent), [currentNoteContent]);
  const isSidebarSearchJumpPending = isSidebarSearchNavigationPending(currentNotePath);

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

      if (isSidebarSearchNavigationPending(path)) {
        logSidebarSearchDebug('editor:scroll:event:pending', {
          path,
          scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
          currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
        });
      }

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
    const openTabPaths = new Set(openTabs.map((tab) => tab.path));
    for (const path of scrollPositionsRef.current.keys()) {
      if (!openTabPaths.has(path)) {
        scrollPositionsRef.current.delete(path);
      }
    }
  }, [openTabs]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const previousPath = activePathRef.current;
    logSidebarSearchDebug('editor:scroll-restore:effect:start', {
      previousPath,
      currentNotePath: currentNotePath ?? null,
      isSidebarSearchJumpPending,
      scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
    });

    if (previousPath) {
      const cachedScrollTop = scrollPositionsRef.current.get(previousPath);
      const nextSavedScrollTop = cachedScrollTop ?? scrollRoot.scrollTop;
      scrollPositionsRef.current.set(previousPath, nextSavedScrollTop);
      logSidebarSearchDebug('editor:scroll-restore:save-previous', {
        previousPath,
        savedScrollTop: nextSavedScrollTop,
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
    }

    activePathRef.current = currentNotePath ?? null;

    if (!currentNotePath) {
      restoreSessionRef.current = null;
      scrollRoot.scrollTop = 0;
      logSidebarSearchDebug('editor:scroll-restore:reset-empty', {
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
      return;
    }

    if (isSidebarSearchNavigationPending(currentNotePath)) {
      restoreSessionRef.current = null;
      logSidebarSearchDebug('editor:scroll-restore:skip-pending', {
        currentNotePath,
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
        currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
      });
      return;
    }

    const targetScrollTop = scrollPositionsRef.current.get(currentNotePath) ?? 0;
    restoreSessionRef.current = {
      path: currentNotePath,
      targetScrollTop,
    };

    logSidebarSearchDebug('editor:scroll-restore:begin', {
      currentNotePath,
      targetScrollTop,
      scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
    });

    const restoreScrollTop = (reason: string) => {
      if (activePathRef.current !== currentNotePath) return;
      scrollRoot.scrollTop = targetScrollTop;
      logSidebarSearchDebug('editor:scroll-restore:apply', {
        currentNotePath,
        reason,
        targetScrollTop,
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
    };

    const finishRestoreSession = () => {
      if (activePathRef.current !== currentNotePath) return;
      scrollPositionsRef.current.set(currentNotePath, scrollRoot.scrollTop);
      restoreSessionRef.current = null;
      logSidebarSearchDebug('editor:scroll-restore:finish', {
        currentNotePath,
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
    };

    restoreScrollTop('sync');
    let innerFrame: number | undefined;
    const frameA = requestAnimationFrame(() => {
      restoreScrollTop('raf-1');
    });
    const frameB = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        restoreScrollTop('raf-2');
      });
    });
    const timeoutId = window.setTimeout(() => {
      restoreScrollTop('timeout');
      finishRestoreSession();
    }, 120);

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      if (innerFrame !== undefined) cancelAnimationFrame(innerFrame);
      window.clearTimeout(timeoutId);
      if (restoreSessionRef.current?.path === currentNotePath) {
        restoreSessionRef.current = null;
      }
      logSidebarSearchDebug('editor:scroll-restore:cleanup', {
        currentNotePath,
        scrollRoot: getSidebarSearchDebugScrollMeta(scrollRoot),
      });
    };
  }, [currentNotePath]);

  useEffect(() => {
    logSidebarSearchDebug('editor:overlay-visibility', {
      currentNotePath: currentNotePath ?? null,
      hidden: isSidebarSearchJumpPending,
      scrollRoot: getSidebarSearchDebugScrollMeta(scrollRootRef.current),
      currentView: getSidebarSearchDebugViewMeta(getCurrentEditorView()),
    });
  }, [currentNotePath, isSidebarSearchJumpPending]);

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

          <MilkdownProvider key={`${currentNotePath ?? 'empty'}:${currentNoteRevision}`}>
            <MilkdownEditorInner />
          </MilkdownProvider>
        </div>
      </OverlayScrollArea>
    </div>
  );
}
