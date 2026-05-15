import { useEffect, type RefObject } from 'react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { useNotesStore } from '@/stores/useNotesStore';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import {
  compareLineBreakText,
  isNotesDebugLoggingEnabled,
  logLineBreakDebug,
  summarizeLineBreakText,
} from '@/stores/notes/lineBreakDebugLog';
import {
  normalizeSerializedMarkdownDocument,
  restoreMathBlockFenceStylesFromReference,
  summarizeMarkdownNormalizationPipeline,
} from '@/lib/notes/markdown/markdownSerializationUtils';
import { serializeLeadingFrontmatterMarkdown } from '../plugins/frontmatter/frontmatterMarkdown';

interface MilkdownToken<T> {
  readonly __milkdownType?: T;
}

interface MilkdownContext {
  get<T>(token: MilkdownToken<T>): T;
}

interface MilkdownEditorLike {
  ctx: MilkdownContext;
}

type EditorGetter = () => MilkdownEditorLike | null | undefined;

interface PendingMarkdownFlusherOptions {
  currentNotePath: string | undefined;
  pendingMarkdownUpdateFrameRef: RefObject<number | null>;
  pendingMarkdownRef: RefObject<string | null>;
  hasEditorUserInputRef: RefObject<boolean>;
  currentNotePathRef: RefObject<string | undefined>;
  currentNoteContentRef: RefObject<string>;
  getEditorRef: RefObject<EditorGetter | undefined>;
}

export function usePendingMarkdownFlusher({
  currentNotePath,
  pendingMarkdownUpdateFrameRef,
  pendingMarkdownRef,
  hasEditorUserInputRef,
  currentNotePathRef,
  currentNoteContentRef,
  getEditorRef,
}: PendingMarkdownFlusherOptions) {
  useEffect(() => {
    const flushPendingMarkdown = () => {
      const debugEnabled = isNotesDebugLoggingEnabled();
      const hadFrame = pendingMarkdownUpdateFrameRef.current !== null;
      if (pendingMarkdownUpdateFrameRef.current !== null) {
        cancelAnimationFrame(pendingMarkdownUpdateFrameRef.current);
        pendingMarkdownUpdateFrameRef.current = null;
      }
      let pendingMarkdown = pendingMarkdownRef.current;
      const hadPendingRef = pendingMarkdown !== null;
      pendingMarkdownRef.current = null;
      if (pendingMarkdown === null) {
        if (!hasEditorUserInputRef.current) {
          if (debugEnabled) {
            logLineBreakDebug('editor:flush-fallback-skipped-no-user-input', {
              editorNotePath: currentNotePath ?? null,
              latestStorePath: useNotesStore.getState().currentNote?.path ?? null,
              capturedPath: currentNotePathRef.current ?? null,
              captured: summarizeLineBreakText(currentNoteContentRef.current),
            });
          }
        } else {
          try {
            const editor = getEditorRef.current?.();
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
              const styledSerialized = restoreMathBlockFenceStylesFromReference(
                normalizedSerialized,
                currentContent,
              );
              pendingMarkdown = serializeLeadingFrontmatterMarkdown(
                styledSerialized,
                currentContent,
              );
              if (debugEnabled) {
                logLineBreakDebug('editor:flush-fallback-serialized-view', {
                  editorNotePath: currentNotePath ?? null,
                  latestStorePath: state.currentNote?.path ?? null,
                  capturedPath: currentNotePathRef.current ?? null,
                  serialized: summarizeLineBreakText(serialized),
                  normalizedSerialized: summarizeLineBreakText(normalizedSerialized),
                  styledSerialized: summarizeLineBreakText(styledSerialized),
                  normalizationPipeline: summarizeMarkdownNormalizationPipeline(serialized),
                  pending: summarizeLineBreakText(pendingMarkdown),
                  current: summarizeLineBreakText(currentContent),
                  diffCurrentToPending: compareLineBreakText(currentContent, pendingMarkdown),
                  diffSerializedToPending: compareLineBreakText(serialized, pendingMarkdown),
                  usedStoreCurrent: state.currentNote?.path === currentNotePath,
                  usedCache: Boolean(currentNotePath && state.noteContentsCache.has(currentNotePath)),
                });
              }
            }
          } catch (error) {
            if (debugEnabled) {
              logLineBreakDebug('editor:flush-fallback-failed', {
                editorNotePath: currentNotePath ?? null,
                latestStorePath: useNotesStore.getState().currentNote?.path ?? null,
                message: error instanceof Error ? error.message : String(error),
              });
            }
            pendingMarkdown = null;
          }
        }
      }
      if (debugEnabled) {
        logLineBreakDebug('editor:flush-before-store', {
          editorNotePath: currentNotePath ?? null,
          latestStorePath: useNotesStore.getState().currentNote?.path ?? null,
          hadFrame,
          hadPendingRef,
          hadUserInput: hasEditorUserInputRef.current,
          pending: summarizeLineBreakText(pendingMarkdown),
        });
      }
      const flushed = flushPendingEditorMarkdown(currentNotePath, pendingMarkdown);
      if (debugEnabled) {
        logLineBreakDebug('editor:flush-after-store', {
          editorNotePath: currentNotePath ?? null,
          flushed,
          storeCurrentPath: useNotesStore.getState().currentNote?.path ?? null,
          storeCurrent: summarizeLineBreakText(useNotesStore.getState().currentNote?.content),
        });
      }
      return flushed;
    };

    setPendingEditorMarkdownFlusher(flushPendingMarkdown);

    return () => {
      flushPendingMarkdown();
      setPendingEditorMarkdownFlusher(null);
    };
  }, [
    currentNotePath,
    currentNoteContentRef,
    currentNotePathRef,
    getEditorRef,
    hasEditorUserInputRef,
    pendingMarkdownRef,
    pendingMarkdownUpdateFrameRef,
  ]);
}
