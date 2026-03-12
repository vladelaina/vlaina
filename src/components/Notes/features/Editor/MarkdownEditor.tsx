import React, { useEffect, useRef, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  schema as commonmarkSchema,
  inputRules as commonmarkInputRules,
  markInputRules as commonmarkMarkInputRules,
  commands as commonmarkCommands,
  keymap as commonmarkKeymap,
  plugins as commonmarkPlugins,
  syncListOrderPlugin,
} from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Icon } from '@/components/ui/icons';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NoteHeader } from './NoteHeader';
import { useNoteCoverController, NoteCoverCanvas } from '../Cover';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { configureTheme } from './theme';
import { customPlugins } from './config/plugins';
import { useEditorLayout } from './hooks/useEditorLayout';
import { useEditorSave } from './hooks/useEditorSave';
import { calculateTextStats } from './utils/textStats';
import { setCurrentEditorView } from './utils/editorViewRegistry';
import './styles/index.css';

const customCommonmark = [
  commonmarkSchema,
  commonmarkInputRules,
  commonmarkMarkInputRules,
  commonmarkCommands,
  commonmarkKeymap,
  commonmarkPlugins.filter((plugin) => plugin !== syncListOrderPlugin),
].flat();

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
          bullet: '-' as const,
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
      .use(customCommonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(configureTheme)
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
        return;
      }
      const view = editor.ctx.get(editorViewCtx);
      setCurrentEditorView(view as EditorView);
      return () => {
        setCurrentEditorView(null);
      };
    } catch {
      setCurrentEditorView(null);
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
    <div className={cn("milkdown-editor", EDITOR_LAYOUT_CLASS)}>
      <Milkdown />
    </div>
  );
});

export function MarkdownEditor({ isPeeking = false, peekOffset = 0 }: { isPeeking?: boolean; peekOffset?: number }) {
  const { contentOffset } = useEditorLayout(isPeeking, peekOffset);

  const currentNoteSource = useNotesStore(s => s.currentNote?.source ?? 'local');
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return currentNotePath && noteMetadata?.notes ? noteMetadata.notes[currentNotePath] : undefined;
  }, [currentNotePath, noteMetadata]);
  const textStats = useMemo(() => calculateTextStats(currentNoteContent), [currentNoteContent]);

  const starred = currentNoteSource === 'local' && currentNotePath ? isStarred(currentNotePath) : false;
  const coverController = useNoteCoverController(currentNoteSource === 'local' ? currentNotePath : undefined);
  const coverUrl = currentNoteSource === 'local' ? coverController.cover.url : null;

  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
      editor?.focus();
    }
  };

  return (
    <div
      className="h-full flex flex-col bg-[var(--neko-bg-primary)] relative"
      data-note-toolbar-root="true"
      onClick={handleEditorClick}
    >
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        {currentNoteSource === 'local' ? (
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
        ) : null}

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

      <div
        className="flex-1 overflow-auto neko-scrollbar flex flex-col items-center relative"
        data-note-scroll-root="true"
      >
        {currentNoteSource === 'local' ? <NoteCoverCanvas controller={coverController} /> : null}

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
      </div>
    </div>
  );
}
