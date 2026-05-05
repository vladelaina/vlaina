import React, { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  parserCtx,
  remarkStringifyOptionsCtx,
  serializerCtx,
} from '@milkdown/kit/core';
import type { EditorView } from '@milkdown/kit/prose/view';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { tableBlock } from '@milkdown/kit/component/table-block';
import type { Parser } from '@milkdown/kit/transformer';
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react';
import { OverlayScrollArea } from '@/components/ui/overlay-scroll-area';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { NoteHeader } from './NoteHeader';
import { useNoteCoverController, NoteCoverCanvas } from '../Cover';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import { configureTheme } from './theme';
import { customPlugins } from './config/plugins';
import { notesRemarkStringifyOptions } from './config/stringifyOptions';
import { useEditorLayout } from './hooks/useEditorLayout';
import { useEditorSave } from './hooks/useEditorSave';
import { calculateTextStats } from './utils/textStats';
import { createScrollRestoreSession } from './utils/scrollRestoreSession';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import {
  clearCurrentMarkdownRuntime,
  getCurrentEditorView,
  setCurrentEditorView,
  setCurrentMarkdownRuntime,
} from './utils/editorViewRegistry';
import {
  clearCurrentEditorBlockPositionSnapshot,
  createCurrentEditorBlockPositionController,
  subscribeCurrentEditorBlockPositionSnapshot,
} from './utils/editorBlockPositionCache';
import {
  normalizeLeadingFrontmatterMarkdown,
  serializeLeadingFrontmatterMarkdown,
} from './plugins/frontmatter/frontmatterMarkdown';
import { hasTemporaryTailParagraph } from './plugins/cursor/endBlankClickPlugin';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';
import { useNoteEditorFind } from './find';
import {
  normalizeSerializedMarkdownDocument,
  preserveMarkdownBlankLinesForEditor,
  summarizeMarkdownNormalizationPipeline,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { EditorTopRightToolbar } from './EditorTopRightToolbar';
import {
  getSidebarSearchNavigationPendingPath,
  isSidebarSearchNavigationPending,
  subscribeSidebarSearchNavigationPending,
} from '../Sidebar/sidebarSearchNavigation';
import { isDraftNotePath } from '@/stores/notes/draftNote';
import { getNoteMetadataEntry } from '@/stores/notes/noteMetadataState';
import {
  compareLineBreakText,
  logLineBreakDebug,
  summarizeLineBreakText,
} from '@/stores/notes/lineBreakDebugLog';
import './styles/index.css';

function summarizeEditorState(view: EditorView, serializer: (doc: unknown) => string) {
  try {
    const serialized = serializer(view.state.doc);
    const selection = view.state.selection;
    return {
      serialized: summarizeLineBreakText(serialized),
      normalized: summarizeLineBreakText(normalizeSerializedMarkdownDocument(serialized)),
      normalizationPipeline: summarizeMarkdownNormalizationPipeline(serialized),
      childCount: view.state.doc.childCount,
      docText: summarizeLineBreakText(
        view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n')
      ),
      selection: {
        from: selection.from,
        to: selection.to,
        empty: selection.empty,
        parentType: selection.$from.parent.type.name,
        parentOffset: selection.$from.parentOffset,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const MilkdownEditorInner = React.memo(function MilkdownEditorInner() {
  const updateContent = useNotesStore(s => s.updateContent);
  const saveNote = useNotesStore(s => s.saveNote);
  const isNewlyCreated = useNotesStore(s => s.isNewlyCreated);
  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isDraftNote = isDraftNotePath(currentNotePath);

  const hasAutoFocused = useRef(false);
  const hasScheduledAutoFocus = useRef(false);
  const hasIgnoredInitNoise = useRef(false);
  const hasEditorUserInput = useRef(false);
  const pendingMarkdownUpdateFrameRef = useRef<number | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);
  const currentNotePathRef = useRef(currentNotePath);
  const currentNoteContentRef = useRef(currentNoteContent);
  const { debouncedSave, flushSave } = useEditorSave(saveNote);

  const initialContent = useMemo(() => {
    return normalizeSerializedMarkdownDocument(currentNoteContent);
  }, [currentNoteContent]);

  useEffect(() => {
    const handleBlur = () => {
      flushSave();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [flushSave]);

  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        const defaultValue = preserveMarkdownBlankLinesForEditor(
          normalizeLeadingFrontmatterMarkdown(initialContent)
        );
        logLineBreakDebug('editor:init-default-value', {
          currentNotePath: currentNotePath ?? null,
          initialContent: summarizeLineBreakText(initialContent),
          defaultValue: summarizeLineBreakText(defaultValue),
        });

        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, defaultValue);
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          ...notesRemarkStringifyOptions,
        }));

        const initTime = Date.now();
        const INIT_PERIOD = 500;

        ctx.get(listenerCtx)
          .markdownUpdated((ctx, markdown) => {
            const editorView = getCurrentEditorView();
            const liveDoc = editorView
              ? summarizeEditorState(editorView, ctx.get(serializerCtx))
              : null;
            if (editorView && hasTemporaryTailParagraph(editorView.state)) {
              logLineBreakDebug('editor:markdown-update-skipped-temporary-tail', {
                currentNotePath: currentNotePath ?? null,
                raw: summarizeLineBreakText(markdown),
                liveDoc,
              });
              return;
            }

            const isInitializing = Date.now() - initTime < INIT_PERIOD;
            if (
              isInitializing &&
              !hasIgnoredInitNoise.current &&
              initialContent.trim().length > 0 &&
              markdown.trim().length < 5
            ) {
              hasIgnoredInitNoise.current = true;
              return;
            }

            const currentContent = useNotesStore.getState().currentNote?.content ?? '';
            const normalizedMarkdown = normalizeSerializedMarkdownDocument(markdown);
            const nextMarkdown = serializeLeadingFrontmatterMarkdown(normalizedMarkdown, currentContent);
            if (!hasEditorUserInput.current) {
              logLineBreakDebug('editor:non-user-markdown-echo-skipped', {
                currentNotePath: currentNotePath ?? null,
                isInitializing,
                raw: summarizeLineBreakText(markdown),
                normalized: summarizeLineBreakText(normalizedMarkdown),
                normalizationPipeline: summarizeMarkdownNormalizationPipeline(markdown),
                next: summarizeLineBreakText(nextMarkdown),
                current: summarizeLineBreakText(currentContent),
                diffCurrentToNext: compareLineBreakText(currentContent, nextMarkdown),
                liveDoc,
              });
              return;
            }
            logLineBreakDebug('editor:markdown-updated', {
              currentNotePath: currentNotePath ?? null,
              raw: summarizeLineBreakText(markdown),
              normalized: summarizeLineBreakText(normalizedMarkdown),
              normalizationPipeline: summarizeMarkdownNormalizationPipeline(markdown),
              next: summarizeLineBreakText(nextMarkdown),
              current: summarizeLineBreakText(currentContent),
              diffCurrentToNext: compareLineBreakText(currentContent, nextMarkdown),
              liveDoc,
            });
            if (currentContent === nextMarkdown) {
              return;
            }

            pendingMarkdownRef.current = nextMarkdown;
            if (pendingMarkdownUpdateFrameRef.current !== null) {
              return;
            }

            pendingMarkdownUpdateFrameRef.current = requestAnimationFrame(() => {
              pendingMarkdownUpdateFrameRef.current = null;
              const pendingMarkdown = pendingMarkdownRef.current;
              pendingMarkdownRef.current = null;
              if (pendingMarkdown === null) {
                return;
              }

              const latestNote = useNotesStore.getState().currentNote;
              if (!latestNote || latestNote.path !== currentNotePath || latestNote.content === pendingMarkdown) {
                logLineBreakDebug('editor:raf-skip-update', {
                  currentNotePath: currentNotePath ?? null,
                  latestNotePath: latestNote?.path ?? null,
                  latest: summarizeLineBreakText(latestNote?.content),
                  pending: summarizeLineBreakText(pendingMarkdown),
                });
                return;
              }
              const latestNotesPath = useNotesStore.getState().notesPath;
              const latestIsDraftNote = isDraftNotePath(latestNote.path);
              logLineBreakDebug('editor:raf-apply-update', {
                currentNotePath,
                notesPath: latestNotesPath,
                isDraftNote: latestIsDraftNote,
                previous: summarizeLineBreakText(latestNote.content),
                next: summarizeLineBreakText(pendingMarkdown),
                liveDoc: editorView
                  ? summarizeEditorState(editorView, ctx.get(serializerCtx))
                  : null,
              });
              updateContent(pendingMarkdown);
              if (!latestIsDraftNote || latestNotesPath) {
                debouncedSave();
              }
            });
          });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(configureTheme)
      .use(tableBlock)
      .use(customPlugins),
    [currentNotePath]
  );

  useEffect(() => {
    hasAutoFocused.current = false;
    hasScheduledAutoFocus.current = false;
    hasIgnoredInitNoise.current = false;
    hasEditorUserInput.current = false;
  }, [currentNotePath]);

  useEffect(() => {
    currentNotePathRef.current = currentNotePath;
    currentNoteContentRef.current = currentNoteContent;
  }, [currentNotePath, currentNoteContent]);

  useEffect(() => {
    const flushPendingMarkdown = () => {
      const hadFrame = pendingMarkdownUpdateFrameRef.current !== null;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        cancelAnimationFrame(pendingMarkdownUpdateFrameRef.current);
        pendingMarkdownUpdateFrameRef.current = null;
      }
      let pendingMarkdown = pendingMarkdownRef.current;
      const hadPendingRef = pendingMarkdown !== null;
      pendingMarkdownRef.current = null;
      if (pendingMarkdown === null) {
        if (!hasEditorUserInput.current) {
          logLineBreakDebug('editor:flush-fallback-skipped-no-user-input', {
            editorNotePath: currentNotePath ?? null,
            latestStorePath: useNotesStore.getState().currentNote?.path ?? null,
            capturedPath: currentNotePathRef.current ?? null,
            captured: summarizeLineBreakText(currentNoteContentRef.current),
          });
        } else {
          try {
            const editor = get?.();
            const view = editor?.ctx.get(editorViewCtx);
            const serializer = editor?.ctx.get(serializerCtx);
            if (view && serializer) {
              const state = useNotesStore.getState();
              const latestCurrentNote = state.currentNote;
              let currentContent = state.noteContentsCache.get(currentNotePath ?? '')?.content
                ?? currentNoteContentRef.current;
              if (latestCurrentNote && latestCurrentNote.path === currentNotePath) {
                currentContent = latestCurrentNote.content;
              }
              const serialized = serializer(view.state.doc);
              const normalizedSerialized = normalizeSerializedMarkdownDocument(serialized);
              pendingMarkdown = serializeLeadingFrontmatterMarkdown(
                normalizedSerialized,
                currentContent,
              );
              logLineBreakDebug('editor:flush-fallback-serialized-view', {
                editorNotePath: currentNotePath ?? null,
                latestStorePath: state.currentNote?.path ?? null,
                capturedPath: currentNotePathRef.current ?? null,
                serialized: summarizeLineBreakText(serialized),
                normalizedSerialized: summarizeLineBreakText(normalizedSerialized),
                normalizationPipeline: summarizeMarkdownNormalizationPipeline(serialized),
                pending: summarizeLineBreakText(pendingMarkdown),
                current: summarizeLineBreakText(currentContent),
                diffCurrentToPending: compareLineBreakText(currentContent, pendingMarkdown),
                diffSerializedToPending: compareLineBreakText(serialized, pendingMarkdown),
                usedStoreCurrent: state.currentNote?.path === currentNotePath,
                usedCache: Boolean(currentNotePath && state.noteContentsCache.has(currentNotePath)),
              });
            }
          } catch (error) {
            logLineBreakDebug('editor:flush-fallback-failed', {
              editorNotePath: currentNotePath ?? null,
              latestStorePath: useNotesStore.getState().currentNote?.path ?? null,
              message: error instanceof Error ? error.message : String(error),
            });
            pendingMarkdown = null;
          }
        }
      }
      logLineBreakDebug('editor:flush-before-store', {
        editorNotePath: currentNotePath ?? null,
        latestStorePath: useNotesStore.getState().currentNote?.path ?? null,
        hadFrame,
        hadPendingRef,
        hadUserInput: hasEditorUserInput.current,
        pending: summarizeLineBreakText(pendingMarkdown),
      });
      const flushed = flushPendingEditorMarkdown(currentNotePath, pendingMarkdown);
      logLineBreakDebug('editor:flush-after-store', {
        editorNotePath: currentNotePath ?? null,
        flushed,
        storeCurrentPath: useNotesStore.getState().currentNote?.path ?? null,
        storeCurrent: summarizeLineBreakText(useNotesStore.getState().currentNote?.content),
      });
      return flushed;
    };

    setPendingEditorMarkdownFlusher(flushPendingMarkdown);

    return () => {
      flushPendingMarkdown();
      setPendingEditorMarkdownFlusher(null);
    };
  }, [currentNotePath, get]);

  useEffect(() => {
    try {
      const editor = get?.();
      if (!editor) {
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
        return;
      }
      const view = editor.ctx.get(editorViewCtx);
      let parser: Parser | null = null;
      let serializedDoc: string | null = null;
      let liveSerializer: ((doc: unknown) => string) | null = null;
      try {
        parser = editor.ctx.get(parserCtx);
      } catch {
        parser = null;
      }
      try {
        const serializer = editor.ctx.get(serializerCtx);
        liveSerializer = serializer;
        serializedDoc = serializer(view.state.doc);
      } catch {
        serializedDoc = null;
        liveSerializer = null;
      }
      logLineBreakDebug('editor:runtime-ready', {
        currentNotePath: currentNotePath ?? null,
        storeContent: summarizeLineBreakText(useNotesStore.getState().currentNote?.content),
        serializedDoc: summarizeLineBreakText(serializedDoc),
        childCount: view.state.doc.childCount,
        docText: summarizeLineBreakText(view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n')),
      });
      setCurrentEditorView(view as EditorView);
      const markUserInput = (event: Event) => {
        const wasAlreadyMarked = hasEditorUserInput.current;
        hasEditorUserInput.current = true;
        const eventType = event.type;
        const inputType = event instanceof InputEvent ? event.inputType : null;
        const key = event instanceof KeyboardEvent ? event.key : null;
        logLineBreakDebug('editor:user-input-marked', {
          currentNotePath: currentNotePath ?? null,
          eventType,
          wasAlreadyMarked,
          inputType,
          key,
          isComposing: event instanceof KeyboardEvent || event instanceof InputEvent
            ? event.isComposing
            : null,
          storeCurrentPath: useNotesStore.getState().currentNote?.path ?? null,
          isDirty: useNotesStore.getState().isDirty,
          beforeDoc: liveSerializer ? summarizeEditorState(view as EditorView, liveSerializer) : null,
        });
        requestAnimationFrame(() => {
          logLineBreakDebug('editor:user-input-after-frame', {
            currentNotePath: currentNotePath ?? null,
            eventType,
            inputType,
            key,
            storeCurrentPath: useNotesStore.getState().currentNote?.path ?? null,
            isDirty: useNotesStore.getState().isDirty,
            afterDoc: liveSerializer ? summarizeEditorState(view as EditorView, liveSerializer) : null,
          });
        });
      };
      view.dom.addEventListener('beforeinput', markUserInput);
      view.dom.addEventListener('keydown', markUserInput);
      view.dom.addEventListener('paste', markUserInput);
      view.dom.addEventListener('cut', markUserInput);
      view.dom.addEventListener('drop', markUserInput);
      const blockPositionController = createCurrentEditorBlockPositionController(view as EditorView);
      setCurrentMarkdownRuntime({ parser });
      return () => {
        view.dom.removeEventListener('beforeinput', markUserInput);
        view.dom.removeEventListener('keydown', markUserInput);
        view.dom.removeEventListener('paste', markUserInput);
        view.dom.removeEventListener('cut', markUserInput);
        view.dom.removeEventListener('drop', markUserInput);
        blockPositionController.destroy();
        setCurrentEditorView(null);
        clearCurrentEditorBlockPositionSnapshot();
        clearCurrentMarkdownRuntime();
      };
    } catch {
      setCurrentEditorView(null);
      clearCurrentEditorBlockPositionSnapshot();
      clearCurrentMarkdownRuntime();
      return;
    }
  }, [get, currentNotePath]);

  const isEmptyContent = useMemo(() => {
    const content = initialContent.trim();
    return content.length === 0 || /^#\s*$/.test(content);
  }, [initialContent]);

  const shouldFocusEmptyDraftBody = isDraftNote && !isNewlyCreated && isEmptyContent;

  const focusEditorBody = useCallback(() => {
    try {
      const editor = get?.();
      if (!editor) {
        return false;
      }

      const view = editor.ctx.get(editorViewCtx);
      if (!view) {
        return false;
      }

      view.focus();
      return true;
    } catch {
      return false;
    }
  }, [get]);

  useEffect(() => {
    if (!get || hasAutoFocused.current || hasScheduledAutoFocus.current) return;
    const blockedReason = isNewlyCreated
      ? 'new-note-title-autofocus'
      : !isEmptyContent
        ? 'non-empty-content'
        : null;
    if (blockedReason) {
      return;
    }

    hasScheduledAutoFocus.current = true;

    const timer = setTimeout(() => {
      const focused = focusEditorBody();
      hasScheduledAutoFocus.current = false;
      if (focused) {
        hasAutoFocused.current = true;
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      hasScheduledAutoFocus.current = false;
    };
  }, [currentNotePath, focusEditorBody, get, isDraftNote, isNewlyCreated, isEmptyContent]);

  useEffect(() => {
    if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
    const frame = requestAnimationFrame(() => {
      if (!shouldFocusEmptyDraftBody || hasAutoFocused.current) return;
      const focused = focusEditorBody();
      if (focused) {
        hasAutoFocused.current = true;
      }
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [currentNotePath, focusEditorBody, shouldFocusEmptyDraftBody]);

  return (
    <div
      className={cn("milkdown-editor", EDITOR_LAYOUT_CLASS)}
      data-note-content-root="true"
    >
      <Milkdown />
    </div>
  );
});

export function MarkdownEditor({
  isPeeking = false,
  peekOffset = 0,
}: {
  isPeeking?: boolean;
  peekOffset?: number;
}) {
  const { contentOffset } = useEditorLayout(isPeeking, peekOffset);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const activePathRef = useRef<string | null>(null);
  const restoreSessionRef = useRef<{ path: string; targetScrollTop: number } | null>(null);

  const currentNotePath = useNotesStore(s => s.currentNote?.path);
  const currentNoteDiskRevision = useNotesStore(s => s.currentNoteDiskRevision);
  const openTabPathsKey = useNotesStore(s => s.openTabs.map((tab) => tab.path).join('\0'));
  const currentNoteContent = useNotesStore(s => s.currentNote?.content ?? '');
  const isStarred = useNotesStore(s => s.isStarred);
  const toggleStarred = useNotesStore(s => s.toggleStarred);
  const noteMetadata = useNotesStore(s => s.noteMetadata);
  
  const currentNoteMetadata = useMemo(() => {
    return getNoteMetadataEntry(noteMetadata, currentNotePath);
  }, [currentNotePath, noteMetadata]);
  const textStats = useMemo(() => calculateTextStats(currentNoteContent), [currentNoteContent]);
  const pendingSidebarSearchNavigationPath = useSyncExternalStore(
    subscribeSidebarSearchNavigationPending,
    getSidebarSearchNavigationPendingPath,
    getSidebarSearchNavigationPendingPath,
  );
  const isSidebarSearchJumpPending =
    Boolean(currentNotePath && pendingSidebarSearchNavigationPath === currentNotePath);

  const starred = currentNotePath ? isStarred(currentNotePath) : false;
  const coverController = useNoteCoverController(currentNotePath);
  const coverUrl = coverController.cover.url;
  const editorFind = useNoteEditorFind(currentNotePath);
  useHeldPageScroll(scrollRootRef);

  const handleEditorClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      const editor = document.querySelector('.milkdown .ProseMirror') as HTMLElement;
      editor?.focus();
    }
  };

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const handleScroll = () => {
      const path = activePathRef.current;
      if (!path) return;

      const restoreSession = restoreSessionRef.current;
      if (restoreSession?.path === path) return;

      scrollPositionsRef.current.set(path, scrollRoot.scrollTop);
    };

    scrollRoot.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollRoot.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const openTabPaths = new Set(openTabPathsKey ? openTabPathsKey.split('\0') : []);
    for (const path of scrollPositionsRef.current.keys()) {
      if (!openTabPaths.has(path)) {
        scrollPositionsRef.current.delete(path);
      }
    }
  }, [openTabPathsKey]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) return;

    const previousPath = activePathRef.current;

    if (previousPath) {
      const cachedScrollTop = scrollPositionsRef.current.get(previousPath);
      const nextSavedScrollTop = cachedScrollTop ?? scrollRoot.scrollTop;
      scrollPositionsRef.current.set(previousPath, nextSavedScrollTop);
    }

    activePathRef.current = currentNotePath ?? null;

    if (!currentNotePath) {
      restoreSessionRef.current = null;
      scrollRoot.scrollTop = 0;
      return;
    }

    if (isSidebarSearchNavigationPending(currentNotePath)) {
      restoreSessionRef.current = null;
      return;
    }

    const targetScrollTop = scrollPositionsRef.current.get(currentNotePath) ?? 0;
    restoreSessionRef.current = {
      path: currentNotePath,
      targetScrollTop,
    };

    let unsubscribeBlockSnapshot = () => {};
    let frameA = 0;
    let timeoutId = 0;

    const restoreSession = createScrollRestoreSession({
      notePath: currentNotePath,
      targetScrollTop,
      getActivePath: () => activePathRef.current,
      getSessionPath: () => restoreSessionRef.current?.path ?? null,
      readScrollTop: () => scrollRoot.scrollTop,
      writeScrollTop: (nextScrollTop) => {
        scrollRoot.scrollTop = nextScrollTop;
      },
      onApply: () => {},
      onFinish: () => {
        scrollPositionsRef.current.set(currentNotePath, scrollRoot.scrollTop);
        restoreSessionRef.current = null;
      },
      onStop: () => {
        unsubscribeBlockSnapshot();
        cancelAnimationFrame(frameA);
        window.clearTimeout(timeoutId);
      },
    });

    restoreSession.restore('sync');
    unsubscribeBlockSnapshot = subscribeCurrentEditorBlockPositionSnapshot((snapshot) => {
      if (
        !restoreSession.isActive()
        || !snapshot
        || snapshot.scrollRoot !== scrollRoot
        || activePathRef.current !== currentNotePath
      ) {
        return;
      }

      const alreadyRestored = restoreSession.restore(`snapshot:${snapshot.version}`, snapshot.scrollTop);
      if (alreadyRestored) {
        restoreSession.finish();
      }
    });
    frameA = requestAnimationFrame(() => {
      const alreadyRestored = restoreSession.restore('raf');
      if (alreadyRestored) {
        restoreSession.finish();
      }
    });
    timeoutId = window.setTimeout(() => {
      restoreSession.restore('timeout');
      restoreSession.finish();
    }, 160);

    return () => {
      restoreSession.stop();
      if (restoreSessionRef.current?.path === currentNotePath) {
        restoreSessionRef.current = null;
      }
    };
  }, [currentNotePath]);

  return (
    <div
      className="h-full flex flex-col bg-[var(--vlaina-bg-primary)] relative"
      data-note-toolbar-root="true"
      onClick={handleEditorClick}
    >
      <EditorTopRightToolbar
        editorFind={editorFind}
        currentNotePath={currentNotePath}
        starred={starred}
        toggleStarred={toggleStarred}
        currentNoteMetadata={currentNoteMetadata}
        textStats={textStats}
      />

      <OverlayScrollArea
        ref={scrollRootRef}
        className={cn(
          'flex-1 relative transition-opacity duration-75',
          isSidebarSearchJumpPending && 'opacity-0 pointer-events-none',
        )}
        viewportClassName="flex flex-col items-center relative"
        draggingBodyClassName="vlaina-overlay-scrollbar-dragging"
        scrollbarVariant="compact"
        data-note-scroll-root="true"
      >
        <NoteCoverCanvas
          controller={coverController}
          notePath={currentNotePath}
        />

        <div
          className="w-full flex flex-col items-center"
          style={{
            marginLeft: contentOffset,
            transition: 'margin-left 180ms cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        >
          <NoteHeader
            coverUrl={coverUrl}
            onAddCover={coverController.addRandomCoverAndOpenPicker}
          />

          <MilkdownProvider key={`${currentNotePath ?? 'empty'}:${currentNoteDiskRevision}`}>
            <MilkdownEditorInner />
          </MilkdownProvider>
        </div>
      </OverlayScrollArea>
    </div>
  );
}
