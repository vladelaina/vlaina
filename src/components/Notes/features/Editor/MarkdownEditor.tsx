import React, { useEffect, useRef, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Icon } from '@/components/ui/icons';
import { motion } from 'framer-motion';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NoteHeader } from './NoteHeader';
import { CoverImage } from './components/CoverImage/CoverImage';
import { getCurrentVaultPath } from '@/stores/notes/storage';
import { SPRING_FLASH } from '@/lib/animations';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { configureTheme } from './theme';
import { customPlugins } from './config/plugins';
import { useEditorLayout } from './hooks/useEditorLayout';
import { useEditorSave } from './hooks/useEditorSave';
import './styles/index.css';

const MilkdownEditorInner = React.memo(function MilkdownEditorInner() {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);

  const hasAutoFocused = useRef(false);
  const { debouncedSave } = useEditorSave(saveNote);

  const initialContent = useMemo(() => {
    return useNotesStore.getState().currentNote?.content || '';
  }, [currentNotePath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveNote]);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);

        const initTime = Date.now();
        const INIT_PERIOD = 500;

        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            const isInitializing = Date.now() - initTime < INIT_PERIOD;
            if (isInitializing && initialContent.length > 20 && markdown.trim().length < 5) {
              return;
            }
            requestAnimationFrame(() => {
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
      .use(customPlugins),
    [currentNotePath]
  );

  useEffect(() => {
    hasAutoFocused.current = false;
  }, [currentNotePath]);

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

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return currentNotePath && noteMetadata?.notes ? noteMetadata.notes[currentNotePath] : undefined;
  }, [currentNotePath, noteMetadata]);

  const starred = currentNotePath ? isStarred(currentNotePath) : false;
  const getNoteCover = useNotesStore(s => s.getNoteCover);
  const setNoteCover = useNotesStore(s => s.setNoteCover);
  const [vaultPath, setVaultPath] = React.useState<string>('');
  const [showCoverPicker, setShowCoverPicker] = React.useState(false);
  
  const coverData = useMemo(() => currentNotePath ? getNoteCover(currentNotePath) : {}, [currentNotePath, getNoteCover]);
  const coverUrl = coverData.cover || null;
  const coverX = coverData.coverX ?? 50;
  const coverY = coverData.coverY ?? 50;
  const coverH = coverData.coverH;
  const coverScale = coverData.coverScale ?? 1;

  useEffect(() => {
    const path = getCurrentVaultPath();
    if (path) setVaultPath(path);
  }, []);

  const handleCoverUpdate = (url: string | null, x: number, y: number, h?: number, scale?: number) => {
    if (!currentNotePath) return;
    setNoteCover(currentNotePath, url, x, y, h, scale);
  };

  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
      editor?.focus();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)] relative" onClick={handleEditorClick}>
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
            <DropdownMenuLabel>Note Details</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-muted-foreground grid grid-cols-[60px_1fr] gap-1">
              <span className="font-medium">Created:</span>
              <span>{currentNoteMetadata?.createdAt ? new Date(currentNoteMetadata.createdAt).toLocaleString() : '-'}</span>

              <span className="font-medium">Updated:</span>
              <span>{currentNoteMetadata?.updatedAt ? new Date(currentNoteMetadata.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-auto neko-scrollbar flex flex-col items-center relative">
        <CoverImage
          url={coverUrl}
          positionX={coverX}
          positionY={coverY}
          height={coverH}
          scale={coverScale}
          onUpdate={handleCoverUpdate}
          vaultPath={vaultPath}
          pickerOpen={showCoverPicker}
          onPickerOpenChange={setShowCoverPicker}
        />

        <motion.div
          className="w-full flex flex-col items-center"
          animate={{ x: contentOffset }}
          transition={SPRING_FLASH}
        >
          <NoteHeader
            coverUrl={coverUrl}
            onCoverUpdate={handleCoverUpdate}
            setShowCoverPicker={setShowCoverPicker}
          />

          <MilkdownProvider key={currentNotePath}>
            <MilkdownEditorInner />
          </MilkdownProvider>
        </motion.div>
      </div>
    </div>
  );
}
