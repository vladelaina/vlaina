/**
 * MarkdownEditor - WYSIWYG Markdown editor using Milkdown
 * 
 * Modern block-editor style with enhanced features
 */

import { useEffect, useCallback, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { useNotesStore } from '@/stores/useNotesStore';
import { IconDeviceFloppy, IconStar, IconStarFilled, IconDots, IconClock } from '@tabler/icons-react';
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
      .use(gfm)
      .use(history)
      .use(listener),
    [currentNote?.path]
  );

  return (
    <div className="flex-1 overflow-auto neko-scrollbar milkdown-editor">
      <Milkdown />
    </div>
  );
}

export function MarkdownEditor() {
  const { currentNote, isDirty, saveNote, isStarred, toggleStarred } = useNotesStore();
  const fileName = currentNote?.path.split('/').pop()?.replace('.md', '') || 'Untitled';
  const starred = currentNote ? isStarred(currentNote.path) : false;

  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)]">
      {/* Editor Header - Modern style */}
      <div className={cn(
        "flex items-center justify-between px-4 h-[48px] flex-shrink-0",
        "border-b border-[var(--neko-border)]"
      )}>
        <div className="flex items-center gap-3">
          {/* Document icon */}
          <div className="w-6 h-6 rounded flex items-center justify-center bg-[var(--neko-bg-tertiary)]">
            <svg className="w-4 h-4 text-[var(--neko-icon-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
          </div>
          
          {/* Title */}
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-medium text-[var(--neko-text-primary)]">
              {fileName}
            </h3>
            {isDirty && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--neko-accent-light)] text-[var(--neko-accent)]">
                Editing
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Last edited indicator */}
          <div className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--neko-text-tertiary)]">
            <IconClock className="w-3 h-3" />
            <span>Just now</span>
          </div>
          
          <div className="w-px h-4 bg-[var(--neko-divider)] mx-1" />
          
          {/* Star button */}
          <button
            onClick={() => currentNote && toggleStarred(currentNote.path)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              starred 
                ? "text-yellow-500 hover:bg-[var(--neko-hover)]" 
                : "text-[var(--neko-icon-secondary)] hover:bg-[var(--neko-hover)] hover:text-yellow-500"
            )}
            title={starred ? "Unstar" : "Star"}
          >
            {starred ? <IconStarFilled className="w-4 h-4" /> : <IconStar className="w-4 h-4" />}
          </button>
          
          {/* Save button */}
          <button
            onClick={saveNote}
            disabled={!isDirty}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isDirty 
                ? "text-[var(--neko-icon-primary)] hover:bg-[var(--neko-hover)]" 
                : "text-[var(--neko-text-disabled)] cursor-not-allowed"
            )}
            title="Save (Ctrl+S)"
          >
            <IconDeviceFloppy className="w-4 h-4" />
          </button>
          
          {/* More options */}
          <button
            className="p-1.5 rounded-md text-[var(--neko-icon-secondary)] hover:bg-[var(--neko-hover)] transition-colors"
            title="More options"
          >
            <IconDots className="w-4 h-4" />
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
