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
        
        // 获取第一个节点（应该是标题）
        const firstNode = doc.firstChild;
        if (!firstNode || firstNode.type.name !== 'heading') return false;
        
        // 第一个节点的起始位置是 1（0 是文档开始）
        // 我们只在光标位于第一个节点的最开始位置时阻止 Backspace
        const firstNodeStart = 1;
        
        // 处理 Backspace 键 - 只在光标在第一个节点开头时阻止
        if (event.key === 'Backspace' && empty && from === firstNodeStart) {
          return true; // 阻止删除，防止标题变成普通段落
        }
        
        return false;
      }
    }
  });
});

function MilkdownEditorInner() {
  const { currentNote, updateContent, saveNote } = useNotesStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 防抖保存 - 300ms 延迟，避免频繁保存导致光标跳动
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 300);
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
        // 如果内容为空，给一个空行让编辑器可以聚焦
        const content = currentNote?.content || '';
        ctx.set(defaultValueCtx, content);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
          // 确保内容始终以 # 开头（防止用户删除标题前缀）
          let finalContent = markdown;
          if (!markdown.trim() || markdown.trim() === '') {
            finalContent = '# ';
          } else if (!markdown.startsWith('#')) {
            // 如果第一行不是标题，在开头添加 # 
            finalContent = '# ' + markdown;
          }
          updateContent(finalContent);
          // 防抖保存
          debouncedSave();
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(protectHeadingPlugin),
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
  const { currentNote, isStarred, toggleStarred, getNoteIcon, setNoteIcon, setPreviewIcon, noteIcons, previewIcon } = useNotesStore();
  const starred = currentNote ? isStarred(currentNote.path) : false;
  
  // 直接计算显示图标，订阅 previewIcon 和 noteIcons 状态
  const displayIcon = currentNote 
    ? (previewIcon?.path === currentNote.path ? previewIcon.icon : noteIcons.get(currentNote.path))
    : undefined;
  const noteIcon = currentNote ? getNoteIcon(currentNote.path) : undefined;
  const [showIconPicker, setShowIconPicker] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  
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
  
  const handleIconPreview = (icon: string | null) => {
    if (currentNote) {
      setPreviewIcon(currentNote.path, icon);
    }
  };
  
  const handleIconPickerClose = () => {
    setShowIconPicker(false);
    if (currentNote) {
      setPreviewIcon(currentNote.path, null);
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
