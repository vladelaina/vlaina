/**
 * MarkdownEditor - WYSIWYG Markdown editor using Milkdown
 * 
 * Obsidian-style editor with enhanced features
 */

import { useEffect, useCallback, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { FloppyDiskBackIcon, StarIcon } from '@phosphor-icons/react';
import { EditorStatusBar } from './EditorStatusBar';
import { cn } from '@/lib/utils';

// Editor styles
import './editor.css';

function MilkdownEditorInner() {
  const { currentNote, updateContent, saveNote } = useNotesStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-save with debounce
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 1000);
  }, [saveNote]);

  // Keyboard shortcut for save
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, currentNote?.content || '');
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          updateContent(markdown);
          debouncedSave();
        });
      })
      .use(commonmark)
      .use(gfm) // GitHub Flavored Markdown (tables, strikethrough, task lists)
      .use(history)
      .use(listener),
    [currentNote?.path]
  );

  return (
    <div className="flex-1 overflow-auto milkdown-editor">
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor() {
  const { currentNote, isDirty, saveNote, isStarred, toggleStarred } = useNotesStore();
  const fileName = currentNote?.path.split('/').pop()?.replace('.md', '') || 'Untitled';
  const starred = currentNote ? isStarred(currentNote.path) : false;

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {fileName}
          </h3>
          {isDirty && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              (unsaved)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Star button */}
          <button
            onClick={() => currentNote && toggleStarred(currentNote.path)}
            className={cn(
              "p-1.5 rounded transition-colors",
              starred 
                ? "text-yellow-500 hover:bg-zinc-100 dark:hover:bg-zinc-800" 
                : "text-zinc-400 dark:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-yellow-500"
            )}
            title={starred ? "Unstar" : "Star"}
          >
            <StarIcon className="size-4" weight={starred ? "fill" : "regular"} />
          </button>
          {/* Save button */}
          <button
            onClick={saveNote}
            disabled={!isDirty}
            className={cn(
              "p-1.5 rounded transition-colors",
              isDirty 
                ? "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" 
                : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
            )}
            title="Save (Ctrl+S)"
          >
            <FloppyDiskBackIcon className="size-4" weight="duotone" />
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <MilkdownProvider>
        <MilkdownEditorInner />
      </MilkdownProvider>

      {/* Status Bar */}
      <EditorStatusBar content={currentNote?.content || ''} />
    </div>
  );
}
