/**
 * MarkdownEditor - WYSIWYG Markdown editor using Milkdown
 * 
 * Modern block-editor style with enhanced features
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { IconDots, IconStar } from '@tabler/icons-react';
import { IconHeartbeat } from '@tabler/icons-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { syncTitle, resetTitleSync, useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { IconPicker, NoteIcon } from '../IconPicker';

// Editor styles
import './editor.css';

// 防止删除第一行 # 前缀的插件
const protectHeadingPluginKey = new PluginKey('protectHeading');

const protectHeadingPlugin = $prose(() => {
  return new Plugin({
    key: protectHeadingPluginKey,
    props: {
      handleKeyDown(view, event) {
        const { state } = view;
        const { selection, doc } = state;
        const { from, empty } = selection;
        
        const firstNode = doc.firstChild;
        if (!firstNode || firstNode.type.name !== 'heading') return false;
        
        const firstNodeStart = 1;
        if (event.key === 'Backspace' && empty && from === firstNodeStart) {
          return true;
        }
        
        return false;
      }
    }
  });
});

// 实时标题同步插件
const titleSyncPluginKey = new PluginKey('titleSync');

const titleSyncPlugin = $prose(() => {
  return new Plugin({
    key: titleSyncPluginKey,
    view() {
      return {
        update(view, prevState) {
          if (prevState && prevState.doc.eq(view.state.doc)) return;
          
          const { doc } = view.state;
          const firstNode = doc.firstChild;
          if (firstNode?.type.name === 'heading' && firstNode.attrs.level === 1) {
            const title = firstNode.textContent.trim() || 'Untitled';
            const path = useNotesStore.getState().currentNote?.path;
            if (path) {
              syncTitle(title, path);
            }
          }
        }
      };
    }
  });
});

function MilkdownEditorInner() {
  const { currentNote, updateContent, saveNote } = useNotesStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 防抖保存 - 2000ms 延迟，避免频繁保存导致文件重命名和光标跳动
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 2000);
  }, [saveNote]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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

  useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        const content = currentNote?.content || '';
        ctx.set(defaultValueCtx, content);
        resetTitleSync();
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            let finalContent = markdown;
            if (!markdown.trim() || markdown.trim() === '') {
              finalContent = '# ';
            } else if (!markdown.startsWith('#')) {
              finalContent = '# ' + markdown;
            }
            updateContent(finalContent);
            debouncedSave();
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(protectHeadingPlugin)
      .use(titleSyncPlugin),
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
    <div className="milkdown-editor">
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor() {
  const currentNote = useNotesStore(s => s.currentNote);
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const getNoteIcon = useNotesStore(s => s.getNoteIcon);
  const setNoteIcon = useNotesStore(s => s.setNoteIcon);
  const setPreviewIcon = useNotesStore(s => s.setPreviewIcon);
  
  const displayIcon = useDisplayIcon(currentNote?.path);
  const starred = currentNote ? isStarred(currentNote.path) : false;
  const noteIcon = currentNote ? getNoteIcon(currentNote.path) : undefined;
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const previewRafRef = useRef<number | null>(null);
  const clearPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleIconSelect = (emoji: string) => {
    if (currentNote) {
      setNoteIcon(currentNote.path, emoji);
      setPreviewIcon(currentNote.path, null);
    }
  };

  const handleRemoveIcon = () => {
    if (currentNote) {
      setNoteIcon(currentNote.path, null);
      setPreviewIcon(currentNote.path, null);
    }
  };
  
  const handleIconPreview = useCallback((icon: string | null) => {
    if (!currentNote) return;
    
    // Clear any pending clear timer
    if (clearPreviewTimerRef.current) {
      clearTimeout(clearPreviewTimerRef.current);
      clearPreviewTimerRef.current = null;
    }
    
    if (icon === null) {
      // Delay clearing preview to avoid flicker when moving between icons
      clearPreviewTimerRef.current = setTimeout(() => {
        setPreviewIcon(currentNote.path, null);
      }, 80);
    } else {
      // Immediately show new preview
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      previewRafRef.current = requestAnimationFrame(() => {
        previewRafRef.current = null;
        setPreviewIcon(currentNote.path, icon);
      });
    }
  }, [currentNote, setPreviewIcon]);
  
  const handleIconPickerClose = () => {
    setShowIconPicker(false);
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (clearPreviewTimerRef.current) {
      clearTimeout(clearPreviewTimerRef.current);
      clearPreviewTimerRef.current = null;
    }
    if (currentNote) {
      setPreviewIcon(currentNote.path, null);
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      if (clearPreviewTimerRef.current) {
        clearTimeout(clearPreviewTimerRef.current);
      }
    };
  }, []);
  
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
          <IconStar className="size-4" fill={starred ? "currentColor" : "none"} />
        </button>
        
        {/* More options button */}
        <button
          className={cn(
            "p-1.5 transition-colors",
            "text-zinc-200 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-400"
          )}
        >
          <IconDots className="size-4" />
        </button>
      </div>

      {/* Scrollable content area - icon and editor scroll together */}
      <div className="flex-1 overflow-auto neko-scrollbar">
        {/* Content wrapper - matches editor layout */}
        <div className="max-w-[800px] mx-auto w-full px-10">
          {/* Document Icon & Add Icon Button - aligned with editor content */}
          <div className="pt-8 pb-1">
            {displayIcon ? (
              <button
                ref={iconButtonRef}
                onClick={() => setShowIconPicker(true)}
                className="h-12 hover:scale-110 transition-transform cursor-pointer flex items-center"
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
                <IconHeartbeat className="size-4" />
                <span>Add icon</span>
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
                    currentIcon={noteIcon}
                    onIconChange={(emoji) => currentNote && setNoteIcon(currentNote.path, emoji)}
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
    </div>
  );
}
