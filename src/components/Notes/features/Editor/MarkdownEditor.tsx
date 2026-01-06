// MarkdownEditor - WYSIWYG Markdown editor using Milkdown

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
import { useUIStore } from '@/stores/uiSlice';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn } from '@/lib/utils';
import { IconPicker, NoteIcon } from '../IconPicker';
import { CustomScrollbar } from '@/components/ui/custom-scrollbar';

// Custom plugins - unified import
import {
  headingPlugin,
  mathPlugin,
  mathClickPlugin,
  slashPlugin,
  calloutPlugin,
  tablePlugin,
  dragPlugin,
  highlightPlugin,
  footnotePlugin,
  autolinkPlugin,
  tocPlugin,
  mermaidPlugin,
  codeEnhancePlugin,
  deflistPlugin,
  videoPlugin,
  abbrPlugin,
  wikiLinkPlugin
} from './plugins';

// Editor styles
import './editor.css';

// Flatten plugin arrays for Milkdown
const customPlugins = [
  // Heading with editable hash marks
  ...headingPlugin,
  ...mathPlugin,
  mathClickPlugin,
  slashPlugin,
  ...calloutPlugin,
  tablePlugin,
  dragPlugin,
  // Extended markdown syntax
  ...highlightPlugin,
  ...footnotePlugin,
  autolinkPlugin,
  ...tocPlugin,
  ...mermaidPlugin,
  codeEnhancePlugin,
  ...deflistPlugin,
  ...videoPlugin,
  abbrPlugin,
  wikiLinkPlugin
];

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
          const path = useNotesStore.getState().currentNote?.path;
          if (!path) return;
          
          if (firstNode?.type.name === 'heading' && firstNode.attrs.level === 1) {
            const titleText = firstNode.textContent.trim();
            if (titleText && titleText !== 'Title') {
              useNotesStore.getState().syncDisplayName(path, titleText);
              return;
            }
          }
          
          useNotesStore.getState().syncDisplayName(path, 'Untitled');
        }
      };
    }
  });
});

function MilkdownEditorInner() {
  const { currentNote, updateContent, saveNote } = useNotesStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveNote();
    }, 2000);
  }, [saveNote]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            const finalContent = (!markdown.trim() || markdown.trim() === '') ? '# ' : markdown;
            updateContent(finalContent);
            debouncedSave();
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(titleSyncPlugin)
      .use(customPlugins),
    [currentNote?.path]
  );

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
  
  const setNotesPreviewIcon = useUIStore(s => s.setNotesPreviewIcon);
  
  const displayIcon = useDisplayIcon(currentNote?.path);
  const starred = currentNote ? isStarred(currentNote.path) : false;
  const noteIcon = currentNote ? getNoteIcon(currentNote.path) : undefined;
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isHoveringHeader, setIsHoveringHeader] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const previewRafRef = useRef<number | null>(null);
  const clearPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleIconSelect = (emoji: string) => {
    if (currentNote) {
      setNoteIcon(currentNote.path, emoji);
      setNotesPreviewIcon(null, null);
    }
  };

  const handleRemoveIcon = () => {
    if (currentNote) {
      setNoteIcon(currentNote.path, null);
      setNotesPreviewIcon(null, null);
    }
  };
  
  const handleIconPreview = useCallback((icon: string | null) => {
    if (!currentNote) return;
    
    if (clearPreviewTimerRef.current) {
      clearTimeout(clearPreviewTimerRef.current);
      clearPreviewTimerRef.current = null;
    }
    
    if (icon === null) {
      clearPreviewTimerRef.current = setTimeout(() => {
        setNotesPreviewIcon(null, null);
      }, 80);
    } else {
      if (previewRafRef.current !== null) {
        cancelAnimationFrame(previewRafRef.current);
      }
      previewRafRef.current = requestAnimationFrame(() => {
        previewRafRef.current = null;
        setNotesPreviewIcon(currentNote.path, icon);
      });
    }
  }, [currentNote, setNotesPreviewIcon]);
  
  const handleIconPickerClose = () => {
    setShowIconPicker(false);
    setIsHoveringHeader(false);
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (clearPreviewTimerRef.current) {
      clearTimeout(clearPreviewTimerRef.current);
      clearPreviewTimerRef.current = null;
    }
    setNotesPreviewIcon(null, null);
  };

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
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
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
        
        <button
          className={cn(
            "p-1.5 transition-colors",
            "text-zinc-200 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-400"
          )}
        >
          <IconDots className="size-4" />
        </button>
      </div>

      <CustomScrollbar className="flex-1">
        <div className="max-w-[800px] mx-auto w-full px-10">
          <div 
            className="pt-6 pb-5"
            onMouseEnter={() => setIsHoveringHeader(true)}
            onMouseLeave={() => setIsHoveringHeader(false)}
          >
            {displayIcon ? (
              <button
                ref={iconButtonRef}
                onClick={() => setShowIconPicker(true)}
                className="h-14 hover:scale-105 transition-transform cursor-pointer flex items-center"
              >
                <NoteIcon icon={displayIcon} size={48} />
              </button>
            ) : showIconPicker ? (
              <div className="h-14 flex items-center">
                <button
                  ref={iconButtonRef}
                  className={cn(
                    "flex items-center gap-1.5 py-1 rounded-md text-sm",
                    "text-zinc-400 dark:text-zinc-500"
                  )}
                >
                  <IconHeartbeat className="size-4" />
                  <span>Add icon</span>
                </button>
              </div>
            ) : (
              <button
                ref={iconButtonRef}
                onClick={() => setShowIconPicker(true)}
                className={cn(
                  "flex items-center gap-1.5 py-1 rounded-md text-sm",
                  "text-zinc-400 dark:text-zinc-500",
                  "hover:text-zinc-500 dark:hover:text-zinc-400",
                  "transition-all duration-150",
                  isHoveringHeader ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                <IconHeartbeat className="size-4" />
                <span>Add icon</span>
              </button>
            )}
            
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
        
        <MilkdownProvider key={currentNote?.path}>
          <MilkdownEditorInner />
        </MilkdownProvider>
      </CustomScrollbar>
    </div>
  );
}
