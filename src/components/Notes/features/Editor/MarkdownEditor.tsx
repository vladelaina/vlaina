// MarkdownEditor - WYSIWYG Markdown editor using Milkdown

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { Ellipsis, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn, iconButtonStyles } from '@/lib/utils';
import { NoteHeader } from './NoteHeader';
import { CoverImage } from './CoverImage';
import { getCurrentVaultPath } from '@/stores/notes/storage';
import { SPRING_FLASH } from '@/lib/animations';

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
  linkTooltipPlugin,
  tocPlugin,
  mermaidPlugin,
  codeEnhancePlugin,
  videoPlugin,
  abbrPlugin,
  taskListClickPlugin,
  listCollapsePlugin,
  markdownLinkPlugin,
  debugPlugin,
} from './plugins';
import { GAP_SCALE, CONTENT_MAX_WIDTH, PADDING_DESKTOP, PADDING_MOBILE, EDITOR_LAYOUT_CLASS } from '@/lib/layout';
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
  linkTooltipPlugin,
  ...tocPlugin,
  ...mermaidPlugin,
  codeEnhancePlugin,
  ...videoPlugin,
  abbrPlugin,
  // Task list click interaction
  // Task list click interaction
  taskListClickPlugin,
  // List collapse
  listCollapsePlugin,
  // Markdown Link Live Preview
  markdownLinkPlugin,
];



const MilkdownEditorInner = React.memo(function MilkdownEditorInner() {


  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hasAutoFocused = useRef(false);

  // Read initial content from store without subscribing to updates
  // We read from .getState() to avoid subscribing to content updates
  const initialContent = useMemo(() => {
    return useNotesStore.getState().currentNote?.content || '';
  }, [currentNotePath]);



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
            // Safety guard: prevent accidental wipe during initialization
            const isInitializing = Date.now() - initTime < INIT_PERIOD;
            if (isInitializing && initialContent.length > 20 && markdown.trim().length < 5) {
              return;
            }
            // CRITICAL: Defer state update to next frame to not block IME input
            // This ensures the browser paints the character before React processes state
            requestAnimationFrame(() => {
              updateContent(markdown);
              debouncedSave();
            });
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .use(configureTheme)
      .use(customPlugins),
    [currentNotePath] // Re-create editor when path changes
  );

  // Reset auto-focus flag when note changes
  useEffect(() => {
    hasAutoFocused.current = false;
  }, [currentNotePath]);

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
    <div className={cn("milkdown-editor", EDITOR_LAYOUT_CLASS)}>
      <Milkdown />
    </div>
  );
});



// Calculate the horizontal offset to avoid collision with peeking sidebar
// Uses a "Golden Safety Gap" to maintain aesthetic breathing room
function calculateGoldenOffset(viewportWidth: number, sidebarWidth: number, isPeeking: boolean): number {
  if (!isPeeking) return 0;

  // We need to account for padding because visual collision happens at the text, not the container edge.
  // md breakpoint is 768px.
  // Note: Padding is on both sides. We care about Left Padding.
  const contentPadding = viewportWidth >= 768 ? PADDING_DESKTOP : PADDING_MOBILE;

  // 1. Calculate the "Natural" Left Edge of the text content
  // Container Logic: (Viewport - ContentWidth) / 2
  // Text Logic: ContainerLeft + Padding
  const actualContainerWidth = Math.min(viewportWidth, CONTENT_MAX_WIDTH);
  const containerLeftEdge = (viewportWidth - actualContainerWidth) / 2;
  const naturalTextLeftEdge = containerLeftEdge + contentPadding;

  // 2. Calculate the Safe Zone
  // SidebarWidth + GoldenGap (Phi^4 ~ 37px)
  const goldenGap = sidebarWidth / GAP_SCALE;
  const safeZoneLimit = sidebarWidth + goldenGap;

  // 3. Calculate Required Shift
  // Only shift if the safe zone encroaches on the text content
  const intrusion = safeZoneLimit - naturalTextLeftEdge;

  // If intrusion is positive, we need to shift right by that amount
  return Math.max(0, intrusion);
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

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);

  // Note Metadata for details dropdown
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  const currentNoteMetadata = useMemo(() => {
    return currentNotePath && noteMetadata?.notes ? noteMetadata.notes[currentNotePath] : undefined;
  }, [currentNotePath, noteMetadata]);

  const starred = currentNotePath ? isStarred(currentNotePath) : false;

  // Cover metadata actions
  const getNoteCover = useNotesStore(s => s.getNoteCover);
  const setNoteCover = useNotesStore(s => s.setNoteCover);

  // Cover Image State (derived from centralized metadata)
  const [vaultPath, setVaultPath] = useState<string>('');
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // Get cover from centralized metadata
  const coverData = currentNotePath ? getNoteCover(currentNotePath) : {};
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
    if (!currentNotePath) return;
    setNoteCover(currentNotePath, url, x, y, h, scale);
  };

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
            currentNotePath && toggleStarred(currentNotePath);
          }}
          className={cn(
            "p-1.5 transition-colors",
            starred
              ? "text-yellow-500"
              : `${iconButtonStyles} hover: text - yellow - 500`
          )}
        >
          <Star className="size-4" fill={starred ? "currentColor" : "none"} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "p-1.5 transition-colors",
                iconButtonStyles
              )}
            >
              <Ellipsis className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Note Details</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Future slot for Full Width toggle etc. */}

            <div className="px-2 py-1.5 text-xs text-muted-foreground grid grid-cols-[60px_1fr] gap-1">
              <span className="font-medium">Created:</span>
              <span>{currentNoteMetadata?.createdAt ? new Date(currentNoteMetadata.createdAt).toLocaleString() : '-'}</span>

              <span className="font-medium">Updated:</span>
              <span>{currentNoteMetadata?.updatedAt ? new Date(currentNoteMetadata.updatedAt).toLocaleString() : '-'}</span>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
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
          className="w-full flex flex-col items-center"
          animate={{ x: contentOffset }}
          transition={SPRING_FLASH}
        >
          <NoteHeader
            coverUrl={coverUrl}
            onCoverUpdate={handleCoverUpdate}
            setShowCoverPicker={setShowCoverPicker}
          />

          <MilkdownProvider key={currentNotePath}>
            <MilkdownEditorInner />
          </MilkdownProvider>
        </motion.div>
      </div>
    </div>
  );
}
