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
import { EditorStatusBar } from './EditorStatusBar';

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
  const { currentNote } = useNotesStore();

  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)]">
      {/* Editor Content */}
      <MilkdownProvider>
        <MilkdownEditorInner />
      </MilkdownProvider>

      {/* Status Bar */}
      <EditorStatusBar content={currentNote?.content || ''} />
    </div>
  );
}
