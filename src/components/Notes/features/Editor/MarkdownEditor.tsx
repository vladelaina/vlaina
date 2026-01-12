// MarkdownEditor - WYSIWYG Markdown editor using Milkdown

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Ellipsis, Star, HeartPulse } from 'lucide-react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn, iconButtonStyles } from '@/lib/utils';
import { IconPicker, NoteIcon } from '../IconPicker';
import { getRandomEmoji, loadRecentIcons, addToRecentIcons, loadSkinTone } from '../IconPicker/constants';
import { TitleInput } from './TitleInput';
import { CoverImage } from './CoverImage';
import { getCurrentVaultPath } from '@/stores/notes/storage';

// Custom plugins - unified import
import {
  floatingToolbarPlugin,
  colorMarksPlugin,
  headingPlugin,
  collapsePlugin,
  mathPlugin,
  mathClickPlugin,
  slashPlugin,
  calloutPlugin,
  tablePlugin,
  highlightPlugin,
  footnotePlugin,
  autolinkPlugin,
  tocPlugin,
  mermaidPlugin,
  codeEnhancePlugin,
  deflistPlugin,
  videoPlugin,
  abbrPlugin,
} from './plugins';
import { configureTheme } from './theme';

// Editor styles
import './styles/index.css';

// Flatten plugin arrays for Milkdown
const customPlugins = [
  // Floating toolbar for text selection
  floatingToolbarPlugin,
  // Color marks (text color, bg color, underline)
  ...colorMarksPlugin,
  // Heading with editable hash marks
  ...headingPlugin,
  collapsePlugin,
  ...mathPlugin,
  mathClickPlugin,
  slashPlugin,
  ...calloutPlugin,
  tablePlugin,
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
];

function MilkdownEditorInner() {
  const { currentNote, updateContent, saveNote, isNewlyCreated } = useNotesStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasAutoFocused = useRef(false);

  // Calculate initial content by stripping First H1 if it matches filename
  // No longer stripping the First H1. User has full control.
  const initialContent = useMemo(() => {
    return currentNote?.content || '';
  }, [currentNote?.path]);

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

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialContent);

        // Track initialization period (first 500ms after editor creation)
        const initTime = Date.now();
        const INIT_PERIOD = 500;

        ctx.get(listenerCtx)
          .markdownUpdated((_ctx, markdown) => {
            // Only apply safety guard during initialization period
            const isInitializing = Date.now() - initTime < INIT_PERIOD;

            if (isInitializing) {
              const contentWasSubstantial = initialContent.length > 20;
              const newContentIsTiny = markdown.trim().length < 5;

              if (contentWasSubstantial && newContentIsTiny) {
                console.warn('Prevented accidental note wipe on initialization');
                return;
              }
            }

            // Save raw markdown directly (without re-adding title)
            updateContent(markdown);
            debouncedSave();
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(configureTheme)
      .use(customPlugins),
    [currentNote?.path] // Re-create editor when path changes
  );

  // Reset auto-focus flag when note changes
  useEffect(() => {
    hasAutoFocused.current = false;
  }, [currentNote?.path]);

  // Check if content is empty or minimal (only has heading marker)
  const isEmptyContent = useMemo(() => {
    const content = initialContent.trim();
    // Empty, just #, or # followed by space/nothing
    return content.length === 0 || /^#\s*$/.test(content);
  }, [initialContent]);

  // Focus editor logic - auto focus for new or empty notes
  useEffect(() => {
    if (!get || hasAutoFocused.current) return;
    if (!isNewlyCreated && !isEmptyContent) return;

    // Mark as focused to prevent re-triggering
    hasAutoFocused.current = true;

    // Small delay to ensure editor is ready
    const timer = setTimeout(() => {
      try {
        const editor = get();
        if (!editor) return;

        const view = editor.ctx.get(editorViewCtx);
        if (!view) return;

        // Focus the editor
        view.focus();
      } catch {
        // Editor not ready yet, ignore
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [get, isNewlyCreated, isEmptyContent]);

  return (
    <div className="milkdown-editor w-full max-w-[720px] shrink-0">
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

  // Cover metadata actions
  const getNoteCover = useNotesStore(s => s.getNoteCover);
  const setNoteCover = useNotesStore(s => s.setNoteCover);

  // Cover Image State (derived from centralized metadata)
  const [vaultPath, setVaultPath] = useState<string>('');

  // Get cover from centralized metadata
  const coverData = currentNote ? getNoteCover(currentNote.path) : {};
  const coverUrl = coverData.cover || null;
  const coverY = coverData.coverY ?? 50;
  const coverH = coverData.coverH;

  // Get Vault Path
  useEffect(() => {
    const path = getCurrentVaultPath();
    if (path) setVaultPath(path);
  }, []);

  const handleCoverUpdate = (url: string | null, y: number, h?: number) => {
    if (!currentNote?.path) return;
    setNoteCover(currentNote.path, url, y, h);
  };

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

  // Calculate display name for Title Input
  const noteName = useMemo(() => {
    if (!currentNote) return '';
    const pathParts = currentNote.path.split(/[\\/]/);
    const fileName = pathParts[pathParts.length - 1] || 'Untitled';
    return fileName.replace(/\.md$/, '');
  }, [currentNote?.path]);

  // Click handler to focus editor when clicking empty space
  const handleEditorClick = (e: React.MouseEvent) => {
    // Only focus if clicking the container background directly
    if (e.target === e.currentTarget) {
      const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
      editor?.focus();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--neko-bg-primary)] relative" onClick={handleEditorClick}>
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        <button
          onClick={() => currentNote && toggleStarred(currentNote.path)}
          className={cn(
            "p-1.5 transition-colors",
            starred
              ? "text-yellow-500"
              : `${iconButtonStyles} hover:text-yellow-500`
          )}
        >
          <Star className="size-4" fill={starred ? "currentColor" : "none"} />
        </button>

        <button
          className={cn(
            "p-1.5 transition-colors",
            iconButtonStyles
          )}
        >
          <Ellipsis className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto neko-scrollbar flex flex-col items-center relative">
        <CoverImage
          url={coverUrl}
          positionY={coverY}
          height={coverH}
          onUpdate={handleCoverUpdate}
          vaultPath={vaultPath}
        />

        <div className={cn(
          "max-w-[720px] w-full px-6 sm:px-12 shrink-0 z-10",
          // Pull content up to overlap with cover (Notion-style)
          coverUrl && "mt-[-40px]"
        )}>
          <div
            className={cn(
              "pb-4 transition-all duration-300",
              // If cover exists, minimal top padding since icon overlaps cover
              // If no cover (Aurora), keep it airy.
              coverUrl ? "pt-0" : "pt-24"
            )}
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
                    iconButtonStyles
                  )}
                >
                  <HeartPulse className="size-4" />
                  <span>Add icon</span>
                </button>
              </div>
            ) : (
              <button
                ref={iconButtonRef}
                onClick={() => {
                  if (!noteIcon) {
                    const currentSkinTone = loadSkinTone();
                    const randomEmoji = getRandomEmoji(currentSkinTone);
                    handleIconSelect(randomEmoji);
                    // Add to recent icons so it appears in the picker's recent list
                    const currentRecent = loadRecentIcons();
                    addToRecentIcons(randomEmoji, currentRecent);
                  }
                  setShowIconPicker(true);
                }}
                className={cn(
                  "flex items-center gap-1.5 py-1 rounded-md text-sm",
                  iconButtonStyles,
                  "transition-all duration-150",
                  isHoveringHeader ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
              >
                <HeartPulse className="size-4" />
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
                  />
                </div>
              </div>
            )}
          </div>

          {/* Title Input Component - Independent from Editor Content */}
          {currentNote && (
            <div className="mb-4">
              <TitleInput
                notePath={currentNote.path}
                initialTitle={noteName}
              />
            </div>
          )}

        </div>

        <MilkdownProvider key={currentNote?.path}>
          <MilkdownEditorInner />
        </MilkdownProvider>
      </div>
    </div>
  );
}
