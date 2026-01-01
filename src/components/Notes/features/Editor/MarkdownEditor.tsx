/**
 * MarkdownEditor - WYSIWYG Markdown editor using Milkdown
 * 
 * Modern block-editor style with enhanced features
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { MoreHorizontal, Star, Smile } from 'lucide-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { IconPicker } from '../IconPicker/IconPicker';

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
        // 如果内容为空，给一个空行让编辑器可以聚焦
        const content = currentNote?.content || '';
        ctx.set(defaultValueCtx, content);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          updateContent(markdown);
          debouncedSave();
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener),
    [currentNote?.path]
  );

  // 编辑器挂载后自动聚焦
  useEffect(() => {
    // 延迟聚焦，等待编辑器完全初始化
    const timer = setTimeout(() => {
      const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
      if (editor) {
        editor.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentNote?.path]);

  return (
    <div className="flex-1 overflow-auto neko-scrollbar milkdown-editor">
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor() {
  const { currentNote, isStarred, toggleStarred, getNoteIcon, setNoteIcon } = useNotesStore();
  const starred = currentNote ? isStarred(currentNote.path) : false;
  const noteIcon = currentNote ? getNoteIcon(currentNote.path) : undefined;
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  
  const handleIconSelect = (emoji: string) => {
    if (currentNote) {
      setNoteIcon(currentNote.path, emoji);
    }
  };

  const handleRemoveIcon = () => {
    if (currentNote) {
      setNoteIcon(currentNote.path, null);
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)] relative">
      {/* File action buttons - top right corner */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* Star button */}
        <button
          onClick={() => currentNote && toggleStarred(currentNote.path)}
          className={cn(
            "p-1.5 transition-colors",
            starred 
              ? "text-yellow-500" 
              : "text-zinc-200 dark:text-zinc-700 hover:text-yellow-500"
          )}
        >
          <Star className="size-4" fill={starred ? "currentColor" : "none"} />
        </button>
        
        {/* More options button */}
        <button
          className={cn(
            "p-1.5 transition-colors",
            "text-zinc-200 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-400"
          )}
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* Document Icon & Add Icon Button */}
      <div className="px-12 pt-10 pb-2">
        {noteIcon ? (
          <div className="group relative inline-block">
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(true)}
              className="text-5xl hover:scale-110 transition-transform cursor-pointer"
            >
              {noteIcon}
            </button>
            {/* Remove icon button */}
            <button
              onClick={handleRemoveIcon}
              className={cn(
                "absolute -top-1 -right-1 w-5 h-5 rounded-full",
                "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400",
                "flex items-center justify-center text-xs",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                "hover:bg-zinc-300 dark:hover:bg-zinc-600"
              )}
            >
              ×
            </button>
          </div>
        ) : (
          <button
            ref={iconButtonRef}
            onClick={() => setShowIconPicker(true)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-sm",
              "text-zinc-400 dark:text-zinc-500",
              "hover:bg-zinc-100 dark:hover:bg-zinc-800",
              "transition-colors"
            )}
          >
            <Smile className="size-4" />
            <span>添加图标</span>
          </button>
        )}
        
        {/* Icon Picker Popup */}
        {showIconPicker && (
          <div className="relative">
            <div className="absolute top-2 left-0">
              <IconPicker
                onSelect={handleIconSelect}
                onClose={() => setShowIconPicker(false)}
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Editor Content - key forces re-mount when note changes */}
      <MilkdownProvider key={currentNote?.path}>
        <MilkdownEditorInner />
      </MilkdownProvider>
    </div>
  );
}
