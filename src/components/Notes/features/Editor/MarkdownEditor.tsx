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
import { motion } from 'framer-motion';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { useDisplayIcon } from '@/hooks/useTitleSync';
import { cn, iconButtonStyles } from '@/lib/utils';
import { IconPicker, NoteIcon } from '../IconPicker';
import { getRandomEmoji, loadRecentIcons, addToRecentIcons, loadSkinTone } from '../IconPicker/constants';
import { TitleInput } from './TitleInput';
import { CoverImage } from './CoverImage';
import { getRandomBuiltinCover } from '@/lib/assets/builtinCovers';
import { getCurrentVaultPath } from '@/stores/notes/storage';
import { SPRING_PREMIUM } from '@/lib/animations';

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

// Shared Layout Constant to guarantee strict vertical alignment between Header and Body
// using Golden Ratio-ish Max-Width (900px) and consistent fluid padding.
const EDITOR_LAYOUT_CLASS = "w-full max-w-[900px] px-12 md:px-24 shrink-0";

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
    <div className={cn("milkdown-editor pointer-events-auto", EDITOR_LAYOUT_CLASS)}>
      <Milkdown />
    </div>
  );
}

// Golden ratio constant
function calculateGoldenOffset(_viewportWidth: number, sidebarWidth: number, isPeeking: boolean): number {
  return isPeeking ? sidebarWidth / 2 : 0;
}

export function MarkdownEditor({ isPeeking = false, peekOffset = 0 }: { isPeeking?: boolean; peekOffset?: number }) {
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Track viewport width for golden ratio calculation
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate the offset to maintain golden ratio positioning
  const contentOffset = useMemo(() => {
    return calculateGoldenOffset(viewportWidth, peekOffset, isPeeking);
  }, [viewportWidth, peekOffset, isPeeking]);

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
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // Get cover from centralized metadata
  const coverData = currentNote ? getNoteCover(currentNote.path) : {};
  const coverUrl = coverData.cover || null;
  const coverX = coverData.coverX ?? 50;
  const coverY = coverData.coverY ?? 50;
  const coverH = coverData.coverH;
  const coverScale = coverData.coverScale ?? 1;

  // Get Vault Path
  useEffect(() => {
    const path = getCurrentVaultPath();
    if (path) setVaultPath(path);
  }, []);

  const handleCoverUpdate = (url: string | null, x: number, y: number, h?: number, scale?: number) => {
    if (!currentNote?.path) return;
    setNoteCover(currentNote.path, url, x, y, h, scale);
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
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            currentNote && toggleStarred(currentNote.path);
          }}
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
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "p-1.5 transition-colors",
            iconButtonStyles
          )}
        >
          <Ellipsis className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto neko-scrollbar flex flex-col items-center relative">
        {/* Cover stays fixed - no animation */}
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

        {/* Content area with peek animation - maintains golden ratio positioning */}
        <motion.div
          className="w-full flex flex-col items-center z-40 pointer-events-none"
          animate={{ x: contentOffset }}
          transition={SPRING_PREMIUM}
        >
          <div className={cn(
            EDITOR_LAYOUT_CLASS,
            "z-10 relative transition-[margin] duration-150 ease-out",
            // Pull content up to overlap with cover (Notion-style)
            coverUrl && "mt-[-48px]"
          )}>
            {/* Clickable area to add cover - entire top padding area */}
            {!coverUrl && (
              <div
                className="absolute top-0 left-0 right-0 h-20 cursor-pointer hover:bg-[var(--neko-hover)]/30 transition-colors"
                onClick={() => {
                  // Get all available covers (user uploads + built-in)
                  const allCovers = useNotesStore.getState().getAssetList();
                  let randomCover: string;

                  if (allCovers.length > 0) {
                    // Random from all available covers
                    const randomIndex = Math.floor(Math.random() * allCovers.length);
                    randomCover = allCovers[randomIndex].filename;
                  } else {
                    // Fallback to built-in if no covers loaded yet
                    randomCover = getRandomBuiltinCover();
                  }

                  handleCoverUpdate(randomCover, 50, 50, 200, 1);
                  setShowCoverPicker(true);
                }}
              />
            )}
            <div
              className={cn(
                "pb-4 transition-all duration-150",
                // If cover exists, minimal top padding since icon overlaps cover
                // If no cover, use comfortable top padding (Notion-style ~80px)
                coverUrl ? "pt-0" : "pt-20"
              )}
              onMouseEnter={() => setIsHoveringHeader(true)}
              onMouseLeave={() => setIsHoveringHeader(false)}
            >

              {displayIcon ? (
                <div className="relative h-[60px] flex items-center z-40">
                  <button
                    ref={iconButtonRef}
                    onClick={() => setShowIconPicker(true)}
                    className="hover:scale-105 transition-transform cursor-pointer flex items-center -ml-1.5 pointer-events-auto"
                  >
                    <NoteIcon icon={displayIcon} size={60} />
                  </button>
                </div>
              ) : showIconPicker ? (
                <div className="h-14 flex items-center">
                  <button
                    ref={iconButtonRef}
                    className={cn(
                      "flex items-center gap-1.5 py-1 rounded-md text-sm pointer-events-auto",
                      iconButtonStyles
                    )}
                  >
                    <HeartPulse className="size-4" />
                    <span>Add icon</span>
                  </button>
                </div>
              ) : (
                <div className={cn(
                  "flex items-center gap-2 transition-all duration-150",
                  isHoveringHeader ? "opacity-100" : "opacity-0 pointer-events-none"
                )}>
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
                      "flex items-center gap-1.5 py-1 rounded-md text-sm pointer-events-auto",
                      iconButtonStyles
                    )}
                  >
                    <HeartPulse className="size-4" />
                    <span>Add icon</span>
                  </button>
                </div>
              )}

              {showIconPicker && (
                <div className="relative pointer-events-auto">
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
              <div className="mb-4 pointer-events-auto">
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
        </motion.div>
      </div>
    </div>
  );
}
