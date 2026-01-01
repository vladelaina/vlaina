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
import { IconPicker, NoteIcon } from '../IconPicker';

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
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  
  // 显示的图标：预览图标优先，否则显示实际图标
  const displayIcon = previewIcon || noteIcon;
  
  const handleIconSelect = (emoji: string) => {
    if (currentNote) {
      setNoteIcon(currentNote.path, emoji);
      setPreviewIcon(null);
    }
  };

  const handleRemoveIcon = () => {
    if (currentNote) {
      setNoteIcon(currentNote.path, null);
      setPreviewIcon(null);
    }
  };
  
  const handleIconPreview = (icon: string | null) => {
    setPreviewIcon(icon);
  };
  
  const handleIconPickerClose = () => {
    setShowIconPicker(false);
    setPreviewIcon(null);
  };
  
  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)] relative overflow-auto neko-scrollbar">
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

      {/* Content wrapper - matches editor layout */}
      <div className="max-w-[800px] mx-auto w-full px-10">
        {/* Document Icon & Add Icon Button - aligned with editor content */}
        <div className="pt-8 pb-1">
          {displayIcon ? (
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(true)}
              className="text-5xl hover:scale-110 transition-transform cursor-pointer"
            >
              <NoteIcon icon={displayIcon} size={48} />
            </button>
          ) : (
            <button
              ref={iconButtonRef}
              onClick={() => setShowIconPicker(true)}
              className={cn(
                "flex items-center gap-1.5 py-1 rounded-md text-sm",
                "text-zinc-400 dark:text-zinc-500",
                "hover:text-zinc-500 dark:hover:text-zinc-400",
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
              <div className="absolute top-2 left-0 z-50">
                <IconPicker
                  onSelect={handleIconSelect}
                  onPreview={handleIconPreview}
                  onRemove={handleRemoveIcon}
                  onClose={handleIconPickerClose}
                  hasIcon={!!noteIcon}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Editor Content - key forces re-mount when note changes */}
      <MilkdownProvider key={currentNote?.path}>
        <MilkdownEditorInner />
      </MilkdownProvider>
    </div>
  );
}
