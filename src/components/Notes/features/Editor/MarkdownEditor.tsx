import React, { useEffect, useRef, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Icon } from '@/components/ui/icons';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
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
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
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
        ctx.set(defaultValueCtx, initialContent);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));

        const initTime = Date.now();
        const INIT_PERIOD = 500;

        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
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
            if (currentContent === markdown) {
              return;
            }

            requestAnimationFrame(() => {
              const latestNote = useNotesStore.getState().currentNote;
              if (!latestNote || latestNote.path !== currentNotePath || latestNote.content === markdown) {
                return;
              }
              updateContent(markdown);
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
      return () => {
        setCurrentEditorView(null);
        clearCurrentMarkdownRuntime();
      };
    } catch {
      setCurrentEditorView(null);
      clearCurrentMarkdownRuntime();
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
  const openTabs = useNotesStore(s => s.openTabs);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return currentNotePath && noteMetadata?.notes ? noteMetadata.notes[currentNotePath] : undefined;
  }, [currentNotePath, noteMetadata]);
  const textStats = useMemo(() => calculateTextStats(currentNoteContent), [currentNoteContent]);

  const starred = currentNotePath ? isStarred(currentNotePath) : false;
  const coverController = useNoteCoverController(currentNotePath);
  const coverUrl = coverController.cover.url;

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

    const targetScrollTop = scrollPositionsRef.current.get(currentNotePath) ?? 0;
    restoreSessionRef.current = {
      path: currentNotePath,
      targetScrollTop,
    };

    const restoreScrollTop = () => {
      if (activePathRef.current !== currentNotePath) return;
      scrollRoot.scrollTop = targetScrollTop;
    };

    const finishRestoreSession = () => {
      if (activePathRef.current !== currentNotePath) return;
      scrollPositionsRef.current.set(currentNotePath, scrollRoot.scrollTop);
      restoreSessionRef.current = null;
    };

    restoreScrollTop();
    const frameA = requestAnimationFrame(() => {
      restoreScrollTop();
    });
    const frameB = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restoreScrollTop();
      });
    });
    const timeoutId = window.setTimeout(() => {
      restoreScrollTop();
      finishRestoreSession();
    }, 120);

    return () => {
      cancelAnimationFrame(frameA);
      cancelAnimationFrame(frameB);
      window.clearTimeout(timeoutId);
      if (restoreSessionRef.current?.path === currentNotePath) {
        restoreSessionRef.current = null;
      }
    };
  }, [currentNotePath]);

  return (
    <div
      className="h-full flex flex-col bg-[var(--neko-bg-primary)] relative"
      data-note-toolbar-root="true"
      onClick={handleEditorClick}
    >
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            currentNotePath && toggleStarred(currentNotePath);
          }}
          className={cn(
            "p-1.5 transition-colors",
            starred
              ? "text-yellow-500"
              : `${iconButtonStyles} hover:text-yellow-500`
          )}
        >
          <Icon size="md" name="misc.star" style={{ fill: starred ? "currentColor" : "none" }} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "p-1.5 transition-colors",
                iconButtonStyles
              )}
            >
              <Icon size="md" name="common.more" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-xs text-muted-foreground grid grid-cols-[78px_1fr] gap-1">
              <span className="font-medium">Lines:</span>
              <span className="tabular-nums">{textStats.lineCount}</span>

              <span className="font-medium">Words:</span>
              <span className="tabular-nums">{textStats.wordCount}</span>

              <span className="font-medium">Characters:</span>
              <span className="tabular-nums">{textStats.characterCount}</span>
            </div>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground grid grid-cols-[78px_1fr] gap-1">
              <span className="font-medium">Created:</span>
              <span>{currentNoteMetadata?.createdAt ? new Date(currentNoteMetadata.createdAt).toLocaleString() : '-'}</span>

              <span className="font-medium">Updated:</span>
              <span>{currentNoteMetadata?.updatedAt ? new Date(currentNoteMetadata.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OverlayScrollArea
        ref={scrollRootRef}
        className="flex-1 relative"
        viewportClassName="flex flex-col items-center relative"
        draggingBodyClassName="neko-overlay-scrollbar-dragging"
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

          <MilkdownProvider key={currentNotePath}>
            <MilkdownEditorInner />
          </MilkdownProvider>
        </div>
      </OverlayScrollArea>
    </div>
  );
}
